import { NextRequest, NextResponse } from "next/server";
import { backendJson } from "@/app/api/_shared/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, data } = await backendJson("/api/auth/forgot-password", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("忘记密码代理失败:", error);
    return NextResponse.json({ detail: "发送重置邮件失败" }, { status: 500 });
  }
}
