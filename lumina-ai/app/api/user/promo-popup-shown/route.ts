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
    if (!sessionToken) return unauthorizedResponse();

    const { response, data } = await backendJson("/api/user/promo-popup-shown", {
      method: "POST",
      sessionToken,
    });
    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401 || response.status === 403,
    });
  } catch (error) {
    console.error("更新优惠弹窗状态失败:", error);
    return nextJsonFromBackend(500, { detail: "更新优惠弹窗状态失败" });
  }
}
