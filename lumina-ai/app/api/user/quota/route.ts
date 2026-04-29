import { NextRequest } from "next/server";
import {
  backendJson,
  getRequestSessionToken,
  nextJsonFromBackend,
  unauthorizedResponse,
} from "@/app/api/_shared/backend";

export async function GET(request: NextRequest) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) return unauthorizedResponse();

    const { response, data } = await backendJson("/api/user/quota", { sessionToken });
    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("获取用户额度失败:", error);
    return nextJsonFromBackend(500, { detail: "获取用户额度失败" });
  }
}
