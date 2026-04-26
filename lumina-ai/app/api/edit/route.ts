import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const authHeader = req.headers.get("Authorization");

        const headers: HeadersInit = {
            "Content-Type": "application/json",
        };
        if (authHeader) {
            headers["Authorization"] = authHeader;
        }

        const response = await fetch(`${API_BASE_URL}/api/edit`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("编辑代理失败:", error);
        return NextResponse.json(
            { error: "AI 暂时忙碌，请稍后重试" },
            { status: 500 }
        );
    }
}
