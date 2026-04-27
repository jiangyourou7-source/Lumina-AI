import { NextRequest } from "next/server";
import {
  backendJson,
  getRequestSessionToken,
  nextJsonFromBackend,
  unauthorizedResponse,
} from "@/app/api/_shared/backend";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) {
      return unauthorizedResponse();
    }

    const { itemId } = await params;
    const { response, data } = await backendJson(`/api/gallery/${itemId}`, {
      method: "DELETE",
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("删除作品失败:", error);
    return nextJsonFromBackend(500, { error: "删除作品失败" });
  }
}
