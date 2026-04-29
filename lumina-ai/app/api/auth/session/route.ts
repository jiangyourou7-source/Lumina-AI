import { NextRequest } from "next/server";
import {
  backendJson,
  getRequestSessionToken,
  nextJsonFromBackend,
} from "@/app/api/_shared/backend";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return nextJsonFromBackend(200, { authenticated: false, user: null });
    }

    const { response, data } = await backendJson("/api/auth/me", {
      sessionToken,
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return nextJsonFromBackend(200, { authenticated: false, user: null }, {
          clearSessionCookie: true,
        });
      }
      return nextJsonFromBackend(response.status, data, {
        clearSessionCookie: response.status === 401 || response.status === 403,
      });
    }

    const payload = data as { user: unknown };
    return nextJsonFromBackend(200, {
      authenticated: true,
      user: payload.user,
    });
  } catch (error) {
    console.error("会话恢复失败:", error);
    return nextJsonFromBackend(500, { detail: "会话服务暂时不可用" });
  }
}
