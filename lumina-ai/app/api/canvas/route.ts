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
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.toString();
    const { response, data } = await backendJson(`/api/canvas${query ? `?${query}` : ""}`, {
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("获取画布列表失败:", error);
    return nextJsonFromBackend(500, { error: "获取画布列表失败" });
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const body = await request.json();
    const { response, data } = await backendJson("/api/canvas", {
      method: "POST",
      body,
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("保存画布失败:", error);
    return nextJsonFromBackend(500, { error: "保存画布失败" });
  }
}
