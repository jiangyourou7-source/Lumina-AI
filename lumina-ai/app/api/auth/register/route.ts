import { NextRequest, NextResponse } from "next/server";
import { backendJson } from "@/app/api/_shared/backend";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, data } = await backendJson("/api/auth/register", {
      method: "POST",
      body,
    });

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const payload = data as { session_token?: string; user?: unknown };
    if (!payload.session_token || !payload.user) {
      return NextResponse.json({ detail: "注册响应缺少 session 信息" }, { status: 502 });
    }

    const nextResponse = NextResponse.json({ user: payload.user });
    nextResponse.cookies.set(SESSION_COOKIE_NAME, payload.session_token, getSessionCookieOptions());
    return nextResponse;
  } catch (error) {
    console.error("注册代理失败:", error);
    return NextResponse.json({ detail: "认证服务暂时不可用" }, { status: 500 });
  }
}
