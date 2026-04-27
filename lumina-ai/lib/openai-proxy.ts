import { AUTH_REQUIRED_MESSAGE } from "@/lib/auth-constants";

async function parseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return data?.detail || data?.error || fallback;
}

function withJsonHeaders(options: RequestInit = {}) {
  return {
    ...options,
    credentials: "same-origin" as const,
    cache: "no-store" as const,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  };
}

async function apiJson<T>(
  path: string,
  options: RequestInit = {},
  fallbackError = "请求失败",
  clearSessionOnAuthError = true
): Promise<T> {
  const response = await fetch(path, withJsonHeaders(options));

  if ((response.status === 401 || response.status === 403) && clearSessionOnAuthError) {
    await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }).catch(() => undefined);
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }

  if (!response.ok) {
    throw new Error(await parseError(response, fallbackError));
  }

  return response.json();
}

interface GenerateImageParams {
  prompt: string;
  size?: string;
  resolution?: string;
  quality?: string;
  model?: string;
}

interface GenerateImageResult {
  url: string;
  remaining_quota: number;
}

export async function generateImage(params: GenerateImageParams): Promise<GenerateImageResult> {
  const {
    prompt,
    size = "1024x1024",
    resolution = "1k",
    quality = "high",
    model,
  } = params;

  return apiJson<GenerateImageResult>(
    "/api/generate",
    {
      method: "POST",
      body: JSON.stringify({ prompt, size, resolution, quality, model }),
    },
    "图片生成失败"
  );
}

interface EditImageParams {
  imageUrl: string;
  prompt: string;
  size?: string;
  resolution?: string;
  quality?: string;
  model?: string;
}

interface EditImageResult {
  url: string;
  remaining_quota: number;
}

export async function editImage(params: EditImageParams): Promise<EditImageResult> {
  const {
    imageUrl,
    prompt,
    size = "1024x1024",
    resolution = "1k",
    quality = "high",
    model,
  } = params;

  return apiJson<EditImageResult>(
    "/api/edit",
    {
      method: "POST",
      body: JSON.stringify({ image_url: imageUrl, prompt, size, resolution, quality, model }),
    },
    "图片编辑失败"
  );
}

export interface UserInfo {
  id: number;
  email: string;
  name: string | null;
  avatar: string | null;
  plan: string;
}

export interface AuthResult {
  user: UserInfo;
}

export interface SessionInfo {
  authenticated: boolean;
  user: UserInfo;
}

export async function register(email: string, password: string, name?: string): Promise<AuthResult> {
  const response = await fetch(
    "/api/auth/register",
    withJsonHeaders({
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    })
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "注册失败"));
  }

  return response.json();
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(
    "/api/auth/login",
    withJsonHeaders({
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "登录失败"));
  }

  return response.json();
}

export async function requestPasswordReset(email: string): Promise<{ message: string }> {
  const response = await fetch(
    "/api/auth/forgot-password",
    withJsonHeaders({
      method: "POST",
      body: JSON.stringify({ email }),
    })
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "发送重置邮件失败"));
  }

  return response.json();
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(
    "/api/auth/reset-password",
    withJsonHeaders({
      method: "POST",
      body: JSON.stringify({ token, new_password: newPassword }),
    })
  );

  if (!response.ok) {
    throw new Error(await parseError(response, "重置密码失败"));
  }

  return response.json();
}

export async function getSession(): Promise<SessionInfo | null> {
  const response = await fetch("/api/auth/session", {
    credentials: "same-origin",
    cache: "no-store",
  });

  if (response.status === 401 || response.status === 403) {
    return null;
  }

  if (!response.ok) {
    throw new Error(await parseError(response, "获取会话失败"));
  }

  return response.json();
}

export async function getUserProfile() {
  return apiJson("/api/auth/me", {}, "获取用户信息失败", true);
}

export interface GalleryItem {
  id: number;
  url: string;
  title: string;
  prompt: string | null;
  category: string;
  size: string;
  quality: string;
  source: string;
  created_at: string;
}

export interface GalleryListResponse {
  items: GalleryItem[];
  total: number;
}

export async function getGallery(category?: string, limit = 20, offset = 0): Promise<GalleryListResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  if (category) params.append("category", category);
  return apiJson<GalleryListResponse>(`/api/gallery?${params}`, {}, "获取作品列表失败");
}

export async function addGalleryItem(data: {
  url: string;
  title?: string;
  prompt?: string;
  category?: string;
  size?: string;
  quality?: string;
  source?: string;
}): Promise<GalleryItem> {
  return apiJson<GalleryItem>(
    "/api/gallery",
    {
      method: "POST",
      body: JSON.stringify(data),
    },
    "保存作品失败"
  );
}

export async function deleteGalleryItem(itemId: number) {
  return apiJson(`/api/gallery/${itemId}`, { method: "DELETE" }, "删除作品失败");
}

export interface CanvasData {
  id: number;
  title: string;
  canvas_data: Record<string, unknown>;
  thumbnail: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface CanvasListResponse {
  items: CanvasData[];
  total: number;
}

export async function saveCanvas(
  title: string,
  canvasData: Record<string, unknown>,
  thumbnail?: string
): Promise<CanvasData> {
  return apiJson<CanvasData>(
    "/api/canvas",
    {
      method: "POST",
      body: JSON.stringify({ title, canvas_data: canvasData, thumbnail }),
    },
    "保存画布失败"
  );
}

export async function getCanvasList(limit = 20, offset = 0): Promise<CanvasListResponse> {
  const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
  return apiJson<CanvasListResponse>(`/api/canvas?${params}`, {}, "获取画布列表失败");
}

export async function getCanvas(canvasId: number): Promise<CanvasData> {
  return apiJson<CanvasData>(`/api/canvas/${canvasId}`, {}, "获取画布失败");
}

export async function updateCanvas(
  canvasId: number,
  data: { title?: string; canvas_data?: Record<string, unknown>; thumbnail?: string }
): Promise<CanvasData> {
  return apiJson<CanvasData>(
    `/api/canvas/${canvasId}`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    },
    "更新画布失败"
  );
}

export async function deleteCanvas(canvasId: number) {
  return apiJson(`/api/canvas/${canvasId}`, { method: "DELETE" }, "删除画布失败");
}

export async function logout() {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "same-origin",
  }).catch(() => undefined);
}

export async function isAuthenticated(): Promise<boolean> {
  return !!(await getSession());
}
