import { NextRequest, NextResponse } from "next/server";
import { backendJson } from "@/app/api/_shared/backend";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { response, data } = await backendJson("/api/auth/reset-password", {
      method: "POST",
      body,
    });
    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("重置密码代理失败:", error);
    return NextResponse.json({ detail: "重置密码失败" }, { status: 500 });
  }
}
