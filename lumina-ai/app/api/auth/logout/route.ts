import { NextRequest, NextResponse } from "next/server";
import { backendJson, getRequestSessionToken } from "@/app/api/_shared/backend";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (sessionToken) {
      await backendJson("/api/auth/logout", {
        method: "POST",
        sessionToken,
      });
    }

    const response = NextResponse.json({ message: "已退出登录" });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    console.error("退出登录代理失败:", error);
    const response = NextResponse.json({ message: "已退出登录" });
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
    return response;
  }
}
