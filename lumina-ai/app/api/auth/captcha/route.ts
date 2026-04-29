import { NextResponse } from "next/server";
import { backendJson } from "@/app/api/_shared/backend";

export async function GET() {
  try {
    const { response, data } = await backendJson("/api/auth/captcha");
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("验证码代理失败:", error);
    return NextResponse.json({ detail: "验证码服务暂时不可用" }, { status: 500 });
  }
}
