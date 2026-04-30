import { NextRequest, NextResponse } from "next/server";
import { AUTH_REQUIRED_MESSAGE } from "@/lib/auth-constants";
import { getSessionCookieOptions, SESSION_COOKIE_NAME } from "@/lib/session-cookie";

const BACKEND_API_BASE_URL =
  process.env.BACKEND_API_BASE_URL || "http://localhost:8000";
const LOCAL_BACKEND_FALLBACK_URL =
  process.env.LOCAL_BACKEND_FALLBACK_URL || "http://127.0.0.1:8001";

export function getRequestSessionToken(request: NextRequest) {
  return request.cookies.get(SESSION_COOKIE_NAME)?.value || null;
}

export async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return { detail: text };
  }
}

export async function backendJson(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    sessionToken?: string | null;
    headers?: HeadersInit;
  } = {}
) {
  const headers = new Headers(options.headers || {});
  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.sessionToken) {
    headers.set("Authorization", `Bearer ${options.sessionToken}`);
  }

  const requestInit: RequestInit = {
    method: options.method || "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  };

  let response = await fetch(`${BACKEND_API_BASE_URL}${path}`, requestInit);

  if (shouldTryLocalFallback(response)) {
    response = await fetch(`${LOCAL_BACKEND_FALLBACK_URL}${path}`, requestInit);
  }

  const data = await readJsonResponse(response);
  return { response, data };
}

function shouldTryLocalFallback(response: Response) {
  if (response.status !== 404) return false;
  if (BACKEND_API_BASE_URL === LOCAL_BACKEND_FALLBACK_URL) return false;
  return /^https?:\/\/(127\.0\.0\.1|localhost):8000\/?$/.test(BACKEND_API_BASE_URL);
}

export function unauthorizedResponse() {
  return NextResponse.json({ detail: AUTH_REQUIRED_MESSAGE }, { status: 401 });
}

export function nextJsonFromBackend(
  status: number,
  data: unknown,
  options?: { clearSessionCookie?: boolean }
) {
  const response = NextResponse.json(data, { status });
  if (options?.clearSessionCookie) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
      ...getSessionCookieOptions(),
      maxAge: 0,
    });
  }
  return response;
}
