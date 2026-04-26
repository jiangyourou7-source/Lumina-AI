import argparse
import asyncio
import json
import os
import re
from pathlib import Path
from typing import Any

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
TEMPLATE_FILE = ROOT / "lumina-ai" / "lib" / "templates.ts"

APIMART_POLL_INTERVAL_SECONDS = 4
APIMART_MAX_WAIT_SECONDS = 180


def load_templates() -> list[dict[str, str]]:
    text = TEMPLATE_FILE.read_text(encoding="utf-8")
    pattern = re.compile(
        r'\{\s*id:\s*"(?P<id>[^"]+)",\s*category:\s*"(?P<category>[^"]+)",\s*categoryLabel:\s*"(?P<categoryLabel>[^"]+)",\s*title:\s*"(?P<title>[^"]+)",\s*prompt:\s*"(?P<prompt>[^"]+)",\s*storagePath:\s*"(?P<storagePath>[^"]+)"\s*\}'
    )
    templates = [match.groupdict() for match in pattern.finditer(text)]
    if not templates:
      raise RuntimeError(f"No templates found in {TEMPLATE_FILE}")
    return templates


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


async def ensure_bucket(client: httpx.AsyncClient, supabase_url: str, bucket: str) -> None:
    response = await client.get(f"{supabase_url}/storage/v1/bucket/{bucket}")
    if response.status_code == 200:
        return

    body = response.text[:300]
    bucket_missing = response.status_code == 404 or "Bucket not found" in body
    if not bucket_missing:
        raise RuntimeError(f"Bucket check failed: {response.status_code} {body}")

    create = await client.post(
        f"{supabase_url}/storage/v1/bucket",
        json={"id": bucket, "name": bucket, "public": True, "file_size_limit": 10_485_760},
    )
    if create.status_code not in {200, 201}:
        raise RuntimeError(f"Bucket create failed: {create.status_code} {create.text[:300]}")


async def object_exists(client: httpx.AsyncClient, supabase_url: str, bucket: str, path: str) -> bool:
    response = await client.head(f"{supabase_url}/storage/v1/object/{bucket}/{path}")
    return response.status_code == 200


async def upload_image(
    client: httpx.AsyncClient,
    supabase_url: str,
    bucket: str,
    path: str,
    image_bytes: bytes,
) -> None:
    response = await client.put(
        f"{supabase_url}/storage/v1/object/{bucket}/{path}",
        content=image_bytes,
        headers={"content-type": "image/png", "x-upsert": "true"},
    )
    if response.status_code not in {200, 201}:
        raise RuntimeError(f"Upload failed: {response.status_code} {response.text[:300]}")


async def apimart_request(
    client: httpx.AsyncClient,
    base_url: str,
    api_key: str,
    method: str,
    path: str,
    **kwargs: Any,
) -> dict[str, Any]:
    response = await client.request(
        method,
        f"{base_url.rstrip('/')}{path}",
        headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
        **kwargs,
    )
    try:
        data = response.json()
    except ValueError:
        data = {}

    if response.status_code >= 400:
        raise RuntimeError(f"APIMart error {response.status_code}: {json.dumps(data, ensure_ascii=False)[:500]}")
    if isinstance(data, dict) and data.get("code") not in (None, 200):
        raise RuntimeError(f"APIMart error: {json.dumps(data, ensure_ascii=False)[:500]}")
    return data


async def generate_image_url(
    client: httpx.AsyncClient,
    base_url: str,
    api_key: str,
    model: str,
    prompt: str,
) -> str:
    data = await apimart_request(
        client,
        base_url,
        api_key,
        "POST",
        "/images/generations",
        json={"model": model, "prompt": prompt, "n": 1, "size": "4:3", "resolution": "1k", "quality": "high"},
    )
    items = data.get("data")
    if not isinstance(items, list) or not items or not items[0].get("task_id"):
        raise RuntimeError(f"APIMart did not return task_id: {json.dumps(data, ensure_ascii=False)[:500]}")

    task_id = items[0]["task_id"]
    deadline = asyncio.get_running_loop().time() + APIMART_MAX_WAIT_SECONDS
    while asyncio.get_running_loop().time() < deadline:
        await asyncio.sleep(APIMART_POLL_INTERVAL_SECONDS)
        task_data = await apimart_request(client, base_url, api_key, "GET", f"/tasks/{task_id}", params={"language": "zh"})
        task = task_data.get("data")
        if not isinstance(task, dict):
            raise RuntimeError(f"Invalid task payload: {json.dumps(task_data, ensure_ascii=False)[:500]}")
        if task.get("status") == "completed":
            images = task.get("result", {}).get("images", [])
            if images and isinstance(images[0].get("url"), list) and images[0]["url"]:
                return images[0]["url"][0]
            if images and isinstance(images[0].get("url"), str):
                return images[0]["url"]
            raise RuntimeError("Task completed without image URL")
        if task.get("status") in {"failed", "cancelled"}:
            raise RuntimeError(f"Task failed: {json.dumps(task, ensure_ascii=False)[:500]}")

    raise RuntimeError(f"Task timed out: {task_id}")


async def download_image(client: httpx.AsyncClient, image_url: str) -> bytes:
    response = await client.get(image_url)
    response.raise_for_status()
    return response.content


async def main() -> int:
    load_dotenv(ROOT / "fastapi-backend" / ".env")
    load_dotenv(ROOT / "lumina-ai" / ".env.local")

    parser = argparse.ArgumentParser(description="Generate Lumina template images and upload them to Supabase Storage.")
    parser.add_argument("--force", action="store_true", help="Regenerate and overwrite existing images.")
    parser.add_argument("--limit", type=int, default=0, help="Generate only the first N templates.")
    parser.add_argument("--only", default="", help="Generate a single template by id.")
    args = parser.parse_args()

    openai_key = env("OPENAI_API_KEY")
    base_url = env("OPENAI_BASE_URL", "https://api.apimart.ai/v1")
    model = env("OPENAI_IMAGE_MODEL", "gpt-image-2")
    supabase_url = env("SUPABASE_URL") or env("NEXT_PUBLIC_SUPABASE_URL")
    service_key = env("SUPABASE_SERVICE_ROLE_KEY")
    bucket = env("SUPABASE_TEMPLATE_BUCKET", "lumina-templates")

    missing = [
        name
        for name, value in {
            "OPENAI_API_KEY": openai_key,
            "SUPABASE_URL": supabase_url,
            "SUPABASE_SERVICE_ROLE_KEY": service_key,
        }.items()
        if not value
    ]
    if missing:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "Missing environment variables",
                    "missing": missing,
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2

    templates = load_templates()
    if args.only:
        templates = [item for item in templates if item["id"] == args.only]
        if not templates:
            print(
                json.dumps(
                    {
                        "ok": False,
                        "error": f"Template id not found: {args.only}",
                    },
                    ensure_ascii=False,
                    indent=2,
                )
            )
            return 2
    if args.limit:
        templates = templates[: args.limit]

    stats = {"success": 0, "skipped": 0, "failed": 0}
    failures: list[tuple[str, str]] = []
    headers = {"Authorization": f"Bearer {service_key}", "apikey": service_key}

    async with httpx.AsyncClient(timeout=90.0, headers=headers) as supabase_client:
        await ensure_bucket(supabase_client, supabase_url.rstrip("/"), bucket)

        async with httpx.AsyncClient(timeout=90.0) as api_client:
            for index, template in enumerate(templates, start=1):
                label = f"[{index}/{len(templates)}] {template['id']}"
                try:
                    if not args.force and await object_exists(
                        supabase_client,
                        supabase_url.rstrip("/"),
                        bucket,
                        template["storagePath"],
                    ):
                        print(f"{label} skipped")
                        stats["skipped"] += 1
                        continue

                    print(f"{label} generating")
                    image_url = await generate_image_url(api_client, base_url, openai_key, model, template["prompt"])
                    image_bytes = await download_image(api_client, image_url)
                    await upload_image(
                        supabase_client,
                        supabase_url.rstrip("/"),
                        bucket,
                        template["storagePath"],
                        image_bytes,
                    )
                    print(f"{label} uploaded")
                    stats["success"] += 1
                except Exception as exc:
                    print(f"{label} failed: {exc}")
                    failures.append((template["id"], str(exc)))
                    stats["failed"] += 1

    print(json.dumps({"stats": stats, "failures": failures}, ensure_ascii=False, indent=2))
    return 1 if failures else 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
