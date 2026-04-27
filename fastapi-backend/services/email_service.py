import logging

import httpx

from core.config import EMAIL_FROM, RESEND_API_KEY

logger = logging.getLogger(__name__)


async def send_password_reset_email(email: str, reset_url: str) -> bool:
    if not RESEND_API_KEY:
        logger.warning("RESEND_API_KEY is not configured; password reset email was not sent.")
        return False

    html = f"""
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6;color:#111827">
      <h2>重置你的 Drmina AI 密码</h2>
      <p>点击下面的按钮设置新密码。链接 30 分钟内有效。</p>
      <p>
        <a href="{reset_url}" style="display:inline-block;background:#007aff;color:#fff;padding:12px 18px;border-radius:12px;text-decoration:none;font-weight:600">
          重置密码
        </a>
      </p>
      <p style="color:#6b7280;font-size:13px">如果按钮无法打开，请复制这个链接到浏览器：</p>
      <p style="word-break:break-all;color:#2563eb;font-size:13px">{reset_url}</p>
      <p style="color:#6b7280;font-size:13px">如果这不是你本人操作，可以忽略这封邮件。</p>
    </div>
    """

    payload = {
        "from": EMAIL_FROM,
        "to": [email],
        "subject": "重置你的 Drmina AI 密码",
        "html": html,
    }

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
            response.raise_for_status()
        return True
    except httpx.HTTPError as exc:
        logger.exception("Failed to send password reset email: %s", exc)
        return False
