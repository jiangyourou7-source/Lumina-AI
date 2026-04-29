import { NextRequest } from "next/server";
import {
  backendJson,
  getRequestSessionToken,
  nextJsonFromBackend,
  unauthorizedResponse,
} from "@/app/api/_shared/backend";

type RouteContext = {
  params: Promise<{ path: string[] }>;
};

async function resolvePath(context: RouteContext) {
  const params = await context.params;
  return `/api/admin/${params.path.join("/")}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) return unauthorizedResponse();

    const path = await resolvePath(context);
    const query = request.nextUrl.search || "";
    const { response, data } = await backendJson(`${path}${query}`, { sessionToken });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401,
    });
  } catch (error) {
    console.error("admin GET proxy failed:", error);
    return nextJsonFromBackend(500, { detail: "后台服务暂时不可用" });
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const sessionToken = getRequestSessionToken(request);
    if (!sessionToken) return unauthorizedResponse();

    const path = await resolvePath(context);
    const body = await request.json().catch(() => undefined);
    const { response, data } = await backendJson(path, {
      method: "POST",
      body,
      sessionToken,
    });

    return nextJsonFromBackend(response.status, data, {
      clearSessionCookie: response.status === 401,
    });
  } catch (error) {
    console.error("admin POST proxy failed:", error);
    return nextJsonFromBackend(500, { detail: "后台服务暂时不可用" });
  }
}
