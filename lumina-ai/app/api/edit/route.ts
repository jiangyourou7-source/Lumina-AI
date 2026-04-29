import { NextRequest } from "next/server";
import {
  backendJson,
  getRequestSessionToken,
  nextJsonFromBackend,
  unauthorizedResponse,
} from "@/app/api/_shared/backend";

export async function POST(request: NextRequest) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { response, data } = await backendJson("/api/edit", {
      method: "POST",
      body,
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401,
    });
  } catch (error) {
    console.error("编辑代理失败:", error);
    return nextJsonFromBackend(500, { error: "AI 暂时忙碌，请稍后重试" });
  }
}
