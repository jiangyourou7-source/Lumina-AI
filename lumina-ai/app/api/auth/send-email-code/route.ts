import { NextRequest, NextResponse } from "next/server";
import { backendJson } from "@/app/api/_shared/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, data } = await backendJson("/api/auth/send-email-code", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("邮箱验证码代理失败:", error);
    return NextResponse.json({ detail: "邮箱验证码服务暂时不可用" }, { status: 500 });
  }
}
