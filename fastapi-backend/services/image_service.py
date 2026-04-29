import asyncio
import base64
import binascii
import ipaddress
import logging
import socket
from urllib.parse import urlparse

import httpx
from openai import APIConnectionError, APIStatusError, AuthenticationError, BadRequestError, OpenAI

from core.config import (
    APIMART_MAX_WAIT_SECONDS,
    APIMART_POLL_INTERVAL_SECONDS,
    OPENAI_API_KEY,
    OPENAI_BASE_URL,
    OPENAI_IMAGE_MODEL,
)

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_IMAGE_TYPES = {"image/png", "image/jpeg", "image/webp"}
APIMART_4K_RATIOS = {"16:9", "9:16", "2:1", "1:2", "21:9", "9:21"}


class ImageServiceError(Exception):
    """Safe error message for API clients; raw provider details stay in logs."""


client = OpenAI(
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL,
)


async def generate_image(
    prompt: str,
    size: str = "1024x1024",
    resolution: str = "1k",
    quality: str = "high",
    model: str | None = None,
) -> str:
    try:
        if _is_apimart_base_url():
            return await _submit_apimart_image_task(
                prompt=prompt,
                size=size,
                resolution=resolution,
                quality=quality,
                model=model or OPENAI_IMAGE_MODEL,
            )
        return await _generate_openai_image(prompt, size, quality, model)
    except Exception as e:
        logger.error(f"图片生成失败: {str(e)}")
        raise _to_safe_image_error(e) from e


async def edit_image(
    image_url: str,
    prompt: str,
    size: str = "1024x1024",
    resolution: str = "1k",
    quality: str = "high",
    model: str | None = None,
) -> str:
    try:
        if _is_apimart_base_url():
            await _validate_image_source(image_url)
            return await _submit_apimart_image_task(
                prompt=prompt,
                size=size,
                resolution=resolution,
                quality=quality,
                model=model or OPENAI_IMAGE_MODEL,
                image_urls=[image_url],
            )

        image_bytes, mime_type = await _load_image(image_url)
        return await _edit_openai_image(image_bytes, mime_type, prompt, size, quality, model)
    except Exception as e:
        logger.error(f"图片编辑失败: {str(e)}")
        raise _to_safe_image_error(e) from e


async def compose_portrait_image(
    image_urls: list[str],
    prompt: str,
    size: str = "1024x1024",
    resolution: str = "1k",
    quality: str = "high",
    model: str | None = None,
) -> str:
    try:
        if not image_urls:
            raise ImageServiceError("请至少提供一张写真参考图")

        if _is_apimart_base_url():
            for image_url in image_urls:
                await _validate_image_source(image_url)
            return await _submit_apimart_image_task(
                prompt=prompt,
                size=size,
                resolution=resolution,
                quality=quality,
                model=model or OPENAI_IMAGE_MODEL,
                image_urls=image_urls,
            )

        image_bytes, mime_type = await _load_image(image_urls[0])
        return await _edit_openai_image(image_bytes, mime_type, prompt, size, quality, model)
    except Exception as e:
        logger.error(f"AI 写真合成失败: {str(e)}")
        raise _to_safe_image_error(e) from e


async def _generate_openai_image(
    prompt: str,
    size: str,
    quality: str,
    model: str | None,
) -> str:
    response = client.images.generate(
        model=model or OPENAI_IMAGE_MODEL,
        prompt=prompt,
        size=_to_openai_size(size),
        quality=quality,
    )
    return _extract_openai_image_url(response)


async def _edit_openai_image(
    image_bytes: bytes,
    mime_type: str,
    prompt: str,
    size: str,
    quality: str,
    model: str | None,
) -> str:
    response = client.images.edit(
        model=model or OPENAI_IMAGE_MODEL,
        image=("image.png", image_bytes, mime_type),
        prompt=prompt,
        size="1024x1024" if size != "1024x1024" else size,
        quality=quality,
    )
    return _extract_openai_image_url(response)


def _extract_openai_image_url(response) -> str:
    if response.data and len(response.data) > 0:
        image_data = response.data[0]
        if hasattr(image_data, "url") and image_data.url:
            return image_data.url
        if hasattr(image_data, "b64_json") and image_data.b64_json:
            return f"data:image/png;base64,{image_data.b64_json}"
    raise ImageServiceError("API 未返回图片数据")


async def _submit_apimart_image_task(
    prompt: str,
    size: str,
    resolution: str,
    quality: str,
    model: str,
    image_urls: list[str] | None = None,
) -> str:
    if not OPENAI_API_KEY:
        raise ImageServiceError("图片 API Key 未配置")

    ratio = _to_apimart_ratio(size)
    resolution = _normalize_resolution(resolution)
    _validate_apimart_resolution(ratio, resolution)

    payload: dict[str, object] = {
        "model": model,
        "prompt": prompt,
        "n": 1,
        "size": ratio,
        "resolution": resolution,
    }
    if quality:
        payload["quality"] = quality
    if image_urls:
        payload["image_urls"] = image_urls

    async with httpx.AsyncClient(timeout=60.0) as http_client:
        data = await _apimart_request(
            http_client,
            "POST",
            "/images/generations",
            json=payload,
        )

        task_id = _extract_apimart_task_id(data)
        return await _poll_apimart_task(http_client, task_id)


async def _poll_apimart_task(http_client: httpx.AsyncClient, task_id: str) -> str:
    deadline = asyncio.get_running_loop().time() + APIMART_MAX_WAIT_SECONDS

    while asyncio.get_running_loop().time() < deadline:
        await asyncio.sleep(APIMART_POLL_INTERVAL_SECONDS)
        data = await _apimart_request(
            http_client,
            "GET",
            f"/tasks/{task_id}",
            params={"language": "zh"},
        )
        task = data.get("data") if isinstance(data, dict) else None
        if not isinstance(task, dict):
            raise ImageServiceError("APIMart 任务返回格式异常")

        status = str(task.get("status") or "").lower()
        if status in {"completed", "complete", "success", "succeeded"}:
            return _extract_apimart_image_url(task)
        if status in {"failed", "fail", "cancelled", "canceled", "error"}:
            error = task.get("error") if isinstance(task.get("error"), dict) else {}
            message = error.get("message") or "图片任务失败"
            raise ImageServiceError(str(message))

    raise ImageServiceError("图片生成任务超时，请稍后到作品库查看或重试")


async def _apimart_request(
    http_client: httpx.AsyncClient,
    method: str,
    path: str,
    **kwargs,
) -> dict:
    url = f"{OPENAI_BASE_URL.rstrip('/')}{path}"
    response = await http_client.request(
        method,
        url,
        headers={
            "Authorization": f"Bearer {OPENAI_API_KEY}",
            "Content-Type": "application/json",
        },
        **kwargs,
    )

    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code >= 400:
        raise _to_apimart_error(response.status_code, data)

    if isinstance(data, dict) and data.get("code") not in (None, 200):
        message = _extract_apimart_error_message(data) or f"APIMart 返回错误 {data.get('code')}"
        raise ImageServiceError(message)

    return data


def _extract_apimart_task_id(data: dict) -> str:
    items = data.get("data") if isinstance(data, dict) else None
    if isinstance(items, list) and items:
        task_id = items[0].get("task_id")
        if task_id:
            return str(task_id)
    raise ImageServiceError("APIMart 未返回 task_id")


def _extract_apimart_image_url(task: dict) -> str:
    for root in (task.get("result"), task.get("output"), task.get("data"), task):
        image_url = _find_first_image_url(root)
        if image_url:
            return image_url

    result = task.get("result") if isinstance(task.get("result"), dict) else {}
    images = result.get("images") if isinstance(result, dict) else None
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict):
            urls = first.get("url")
            if isinstance(urls, list) and urls:
                return str(urls[0])
            if isinstance(urls, str):
                return urls
    raise ImageServiceError("APIMart 任务完成但未返回图片 URL")


def _find_first_image_url(value) -> str | None:
    if isinstance(value, str):
        text = value.strip()
        if text.startswith(("http://", "https://", "data:image/")):
            return text
        return None

    if isinstance(value, list):
        for item in value:
            found = _find_first_image_url(item)
            if found:
                return found
        return None

    if isinstance(value, dict):
        preferred_keys = (
            "url",
            "urls",
            "image_url",
            "image_urls",
            "output_url",
            "output",
            "src",
            "images",
        )
        for key in preferred_keys:
            if key in value:
                found = _find_first_image_url(value[key])
                if found:
                    return found

        for item in value.values():
            found = _find_first_image_url(item)
            if found:
                return found

    return None


def _to_apimart_error(status_code: int, data: dict) -> ImageServiceError:
    if status_code == 401:
        return ImageServiceError("APIMart API Key 无效，请检查密钥是否来自 APIMart")
    if status_code == 402:
        return ImageServiceError("APIMart 账户余额不足")
    if status_code == 403:
        return ImageServiceError("APIMart 无权限访问该模型")
    if status_code == 429:
        return ImageServiceError("APIMart 请求过快或触发限流")

    message = _extract_apimart_error_message(data)
    return ImageServiceError(message or f"APIMart 接口返回错误 {status_code}")


def _extract_apimart_error_message(data: dict) -> str | None:
    error = data.get("error") if isinstance(data, dict) else None
    if isinstance(error, dict):
        return error.get("message") or error.get("msg")
    if isinstance(data, dict):
        return data.get("message") or data.get("msg")
    return None


def _is_apimart_base_url() -> bool:
    host = urlparse(OPENAI_BASE_URL).hostname or ""
    return host.endswith("apimart.ai")


def _to_apimart_ratio(size: str) -> str:
    mapping = {
        "1024x1024": "1:1",
        "1536x1024": "3:2",
        "1024x1536": "2:3",
    }
    return mapping.get(size, size)


def _normalize_resolution(resolution: str) -> str:
    value = (resolution or "1k").lower()
    if value not in {"1k", "2k", "4k"}:
        raise ImageServiceError("分辨率仅支持 1K、2K、4K")
    return value


def _validate_apimart_resolution(size: str, resolution: str) -> None:
    if resolution == "4k" and size not in APIMART_4K_RATIOS:
        raise ImageServiceError("4K 仅支持 16:9、9:16、2:1、1:2、21:9、9:21 比例")


def _to_openai_size(size: str) -> str:
    mapping = {
        "1:1": "1024x1024",
        "3:2": "1536x1024",
        "2:3": "1024x1536",
        "16:9": "1536x1024",
        "9:16": "1024x1536",
    }
    return mapping.get(size, size)


def _to_safe_image_error(error: Exception) -> ImageServiceError:
    if isinstance(error, ImageServiceError):
        return error
    if isinstance(error, AuthenticationError):
        return ImageServiceError("图片 API Key 无效，或该 Key 不属于当前接口地址")
    if isinstance(error, BadRequestError):
        return ImageServiceError("图片请求参数无效，请检查模型、尺寸、质量或提示词")
    if isinstance(error, APIConnectionError):
        return ImageServiceError("图片接口连接失败，请检查 OPENAI_BASE_URL")
    if isinstance(error, APIStatusError):
        if error.status_code == 404:
            return ImageServiceError("图片模型不可用，请检查 OPENAI_IMAGE_MODEL")
        if error.status_code == 429:
            return ImageServiceError("图片接口额度不足或请求过快")
        return ImageServiceError(f"图片接口返回错误 {error.status_code}")
    if isinstance(error, httpx.ConnectError):
        return ImageServiceError("图片接口连接失败，请检查 OPENAI_BASE_URL")
    if isinstance(error, httpx.TimeoutException):
        return ImageServiceError("图片接口响应超时，请稍后重试")
    if isinstance(error, ValueError):
        return ImageServiceError(str(error))
    return ImageServiceError("图片生成服务异常，请查看后端日志")


async def _validate_image_source(source: str) -> None:
    if source.startswith("data:"):
        _decode_data_url(source)
        return
    await _download_image(source)


async def _load_image(source: str) -> tuple[bytes, str]:
    if source.startswith("data:"):
        return _decode_data_url(source)
    return await _download_image(source)


def _decode_data_url(source: str) -> tuple[bytes, str]:
    try:
        header, encoded = source.split(",", 1)
    except ValueError as exc:
        raise ValueError("无效的 data URL") from exc

    mime_type = header.removeprefix("data:").split(";")[0].lower()
    if mime_type not in ALLOWED_IMAGE_TYPES or ";base64" not in header:
        raise ValueError("仅支持 PNG、JPG、WEBP 图片")

    try:
        image_bytes = base64.b64decode(encoded, validate=True)
    except binascii.Error as exc:
        raise ValueError("图片 base64 内容无效") from exc

    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise ValueError("图片不能超过 10MB")

    return image_bytes, mime_type


async def _download_image(url: str) -> tuple[bytes, str]:
    parsed = urlparse(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise ValueError("图片地址必须是 http 或 https")

    _ensure_public_host(parsed.hostname)

    async with httpx.AsyncClient(timeout=30.0, follow_redirects=False) as http_client:
        async with http_client.stream("GET", url) as response:
            response.raise_for_status()
            mime_type = response.headers.get("content-type", "").split(";")[0].lower()
            if mime_type not in ALLOWED_IMAGE_TYPES:
                raise ValueError("远程文件不是受支持的图片类型")

            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > MAX_IMAGE_BYTES:
                raise ValueError("图片不能超过 10MB")

            chunks: list[bytes] = []
            total = 0
            async for chunk in response.aiter_bytes():
                total += len(chunk)
                if total > MAX_IMAGE_BYTES:
                    raise ValueError("图片不能超过 10MB")
                chunks.append(chunk)

    return b"".join(chunks), mime_type


def _ensure_public_host(hostname: str) -> None:
    try:
        addresses = socket.getaddrinfo(hostname, None)
    except socket.gaierror as exc:
        raise ValueError("无法解析图片地址") from exc

    for item in addresses:
        ip = ipaddress.ip_address(item[4][0])
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError("不允许访问内网图片地址")
