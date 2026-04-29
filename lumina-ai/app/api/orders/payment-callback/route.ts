import { NextRequest } from "next/server";
import { backendJson, nextJsonFromBackend } from "@/app/api/_shared/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, data } = await backendJson("/api/orders/payment-callback", {
      method: "POST",
      body,
    });
    return nextJsonFromBackend(response.status, data);
  } catch (error) {
    console.error("支付回调失败:", error);
    return nextJsonFromBackend(500, { detail: "支付回调失败" });
  }
}
