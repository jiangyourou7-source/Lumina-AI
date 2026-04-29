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
    const { response, data } = await backendJson("/api/portrait/compose", {
      method: "POST",
      body,
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401,
    });
  } catch (error) {
    console.error("portrait compose proxy failed:", error);
    return nextJsonFromBackend(500, { error: "AI 写真生成暂时不可用，请稍后重试" });
  }
}
