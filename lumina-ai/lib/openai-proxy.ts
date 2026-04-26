const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";
export const AUTH_REQUIRED_MESSAGE = "请先登录";

function getStoredToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("lumina_token");
}

function setStoredToken(token: string) {
  if (typeof window !== "undefined") {
    localStorage.setItem("lumina_token", token);
  }
}

function clearStoredToken() {
  if (typeof window !== "undefined") {
    localStorage.removeItem("lumina_token");
  }
}

async function parseError(response: Response, fallback: string) {
  const data = await response.json().catch(() => null);
  return data?.detail || data?.error || fallback;
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = getStoredToken();
  if (!token) {
    throw new Error(AUTH_REQUIRED_MESSAGE);
  }
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function apiJson<T>(
  path: string,
  options: RequestInit = {},
  fallbackError = "请求失败",
  retry = true
): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers || {}),
    },
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    clearStoredToken();
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
  access_token: string;
  token_type: string;
  user: UserInfo;
}

export async function register(email: string, password: string, name?: string): Promise<AuthResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "注册失败"));
  }

  const result = await response.json();
  setStoredToken(result.access_token);
  return result;
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseError(response, "登录失败"));
  }

  const result = await response.json();
  setStoredToken(result.access_token);
  return result;
}

export async function getUserProfile() {
  return apiJson("/api/auth/me", {}, "获取用户信息失败");
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

export function logout() {
  clearStoredToken();
}

export function isAuthenticated(): boolean {
  return !!getStoredToken();
}
