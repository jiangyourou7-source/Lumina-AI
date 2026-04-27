import { NextRequest } from "next/server";
import {
  backendJson,
  getRequestSessionToken,
  nextJsonFromBackend,
  unauthorizedResponse,
} from "@/app/api/_shared/backend";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { canvasId } = await params;
    const { response, data } = await backendJson(`/api/canvas/${canvasId}`, {
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("获取画布失败:", error);
    return nextJsonFromBackend(500, { error: "获取画布失败" });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { canvasId } = await params;
    const body = await request.json();
    const { response, data } = await backendJson(`/api/canvas/${canvasId}`, {
      method: "PUT",
      body,
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("更新画布失败:", error);
    return nextJsonFromBackend(500, { error: "更新画布失败" });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ canvasId: string }> }
) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { canvasId } = await params;
    const { response, data } = await backendJson(`/api/canvas/${canvasId}`, {
      method: "DELETE",
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("删除画布失败:", error);
    return nextJsonFromBackend(500, { error: "删除画布失败" });
  }
}
