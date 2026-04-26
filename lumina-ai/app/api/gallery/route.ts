import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get("Authorization");
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");
        const limit = searchParams.get("limit") || "20";
        const offset = searchParams.get("offset") || "0";

        const params = new URLSearchParams({ limit, offset });
        if (category) params.append("category", category);

        const headers: HeadersInit = {};
        if (authHeader) {
            headers["Authorization"] = authHeader;
        }

        const response = await fetch(`${API_BASE_URL}/api/gallery?${params}`, {
            headers,
        });

        const data = await response.json();
        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("获取作品列表失败:", error);
        return NextResponse.json(
            { error: "获取作品列表失败" },
            { status: 500 }
        );
    }
}
