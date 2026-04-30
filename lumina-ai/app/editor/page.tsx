"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Download,
  Grid3X3,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Lock,
  LogOut,
  MousePointer2,
  Plus,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Type,
  Unlock,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  CanvasData,
  PortraitReferenceRole,
  composePortrait,
  editImage,
  generateImage,
  getCanvas,
  getCanvasList,
  getSession,
  getUserProfile,
  saveCanvas,
  updateCanvas,
} from "@/lib/openai-proxy";

const CANVAS_SIZE = 1080;
const SNAP_TOLERANCE = 10;
const HISTORY_LIMIT = 80;
const EDITOR_SETTINGS_SEEN_KEY = "drmine-editor-settings-seen";
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_REFERENCE_IMAGE_SIZE = 1600;
const REFERENCE_IMAGE_QUALITY = 0.82;
const DEFAULT_IMAGE_FRAME_SIZE = 640;
const MIN_ELEMENT_SIZE = 40;
const MAX_ELEMENT_SIZE = 4096;
const WORKSPACE_SIZE = 7200;
const WORKSPACE_ORIGIN = (WORKSPACE_SIZE - CANVAS_SIZE) / 2;
const MIN_STAGE_SCALE = 0.18;
const MAX_STAGE_SCALE = 2.5;

type CanvasElement =
  | {
      id: string;
      type: "image";
      src: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      role?: PortraitReferenceRole;
      label?: string;
      lockAspect?: boolean;
    }
  | {
      id: string;
      type: "text";
      content: string;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation: number;
      fontSize: number;
      color: string;
      fontWeight: number;
    };

interface CanvasDocument {
  width: number;
  height: number;
  background: string;
  elements: CanvasElement[];
}

type ResizeHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

interface TransformState {
  id: string;
  ids: string[];
  mode: "move" | "resize" | "rotate";
  startX: number;
  startY: number;
  origin: CanvasElement;
  origins: Record<string, CanvasElement>;
  snapshot: CanvasDocument;
  handle?: ResizeHandle;
  centerClientX?: number;
  centerClientY?: number;
  startAngle?: number;
  startRotation?: number;
}

interface SnapGuide {
  orientation: "vertical" | "horizontal";
  position: number;
}

interface Point {
  x: number;
  y: number;
}

interface MarqueeState {
  start: Point;
  current: Point;
  additive: boolean;
  originIds: string[];
}

interface WorkspacePanState {
  startX: number;
  startY: number;
  origin: Point;
  moved: boolean;
}

interface HistoryState {
  past: CanvasDocument[];
  future: CanvasDocument[];
}

interface VerticalMatch {
  candidate: number;
  key: "left" | "center" | "right";
  distance: number;
}

interface HorizontalMatch {
  candidate: number;
  key: "top" | "center" | "bottom";
  distance: number;
}

type Axis = "x" | "y" | "both";

const resizeHandles: Array<{ handle: ResizeHandle; className: string; cursor: string }> = [
  { handle: "nw", className: "left-0 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "nwse-resize" },
  { handle: "n", className: "left-1/2 top-0 -translate-x-1/2 -translate-y-1/2", cursor: "ns-resize" },
  { handle: "ne", className: "right-0 top-0 -translate-y-1/2 translate-x-1/2", cursor: "nesw-resize" },
  { handle: "e", className: "right-0 top-1/2 -translate-y-1/2 translate-x-1/2", cursor: "ew-resize" },
  { handle: "se", className: "bottom-0 right-0 translate-x-1/2 translate-y-1/2", cursor: "nwse-resize" },
  { handle: "s", className: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2", cursor: "ns-resize" },
  { handle: "sw", className: "bottom-0 left-0 -translate-x-1/2 translate-y-1/2", cursor: "nesw-resize" },
  { handle: "w", className: "left-0 top-1/2 -translate-x-1/2 -translate-y-1/2", cursor: "ew-resize" },
];

const emptyDocument: CanvasDocument = {
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  background: "transparent",
  elements: [],
};

const DEFAULT_PROJECT_TITLE = "未命名项目";

const imageCountOptions = Array.from({ length: 9 }, (_, index) => index + 1);
const materialRoles: Array<{ role: PortraitReferenceRole; label: string; hint: string }> = [
  { role: "person", label: "人物主体", hint: "脸、身形、气质" },
  { role: "top", label: "上衣", hint: "颜色、版型、材质" },
  { role: "pants", label: "裤子/下装", hint: "裤装、裙装" },
  { role: "shoes", label: "鞋子", hint: "鞋型、质感" },
  { role: "accessory", label: "饰品", hint: "包、帽子、首饰" },
  { role: "background", label: "背景", hint: "场景、空间" },
  { role: "style", label: "风格参考", hint: "光影、色调" },
  { role: "other", label: "其他", hint: "辅助参考" },
];

const materialRoleMap = new Map(materialRoles.map((item) => [item.role, item]));

type TextPatch = Partial<Extract<CanvasElement, { type: "text" }>>;

const imageDeleteKeywords = ["删除", "移除", "删掉", "去掉这个图层"];
const imageEnhanceKeywords = ["高清", "清晰", "修复", "锐化", "画质", "增强", "变清楚", "更清楚"];
const textReplacePatterns = [
  /(?:文案|文字|内容)?(?:改成|改为|替换为|写成|变成|文案改为)[:：\s]*(.+)$/i,
  /(?:把|将)(?:文案|文字|内容)?[:：\s]*(.+?)(?:作为|设为|改成|改为)(?:文案|文字|内容)?$/i,
];
const textColorMap: Array<[string[], string]> = [
  [["红色", "红"], "#EF4444"],
  [["蓝色", "蓝"], "#007AFF"],
  [["黑色", "黑"], "#1D1D1F"],
  [["白色", "白"], "#FFFFFF"],
  [["金色", "金"], "#D97706"],
  [["绿色", "绿"], "#16A34A"],
];

function includesAny(value: string, keywords: string[]) {
  return keywords.some((keyword) => value.includes(keyword));
}

function normalizeEditorQuality(value: string) {
  if (value === "自动") return "auto";
  if (value === "高") return "high";
  if (value === "中") return "medium";
  if (value === "低") return "low";
  return "low";
}

function getImageEditPrompt(instruction: string) {
  if (includesAny(instruction, imageEnhanceKeywords)) {
    return "请对当前图片进行高清修复和画质增强，保留主体、构图、文字和品牌元素，让图片更清晰、更锐利、更适合商业发布。";
  }
  return instruction;
}

function extractTextReplacement(instruction: string) {
  for (const pattern of textReplacePatterns) {
    const match = instruction.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value.replace(/^["“”'‘’]+|["“”'‘’]+$/g, "");
  }
  return "";
}

function buildTextPatch(instruction: string, element: Extract<CanvasElement, { type: "text" }>) {
  const patch: TextPatch = {};
  let message = "";
  const replacement = extractTextReplacement(instruction);

  if (replacement) {
    patch.content = replacement;
    message = "已更新文字内容";
  }

  if (includesAny(instruction, ["放大", "变大", "大一点", "加大"])) {
    patch.fontSize = clamp(Math.round(element.fontSize * 1.15), 10, 180);
    message = message || "已放大文字";
  }

  if (includesAny(instruction, ["缩小", "变小", "小一点", "减小"])) {
    patch.fontSize = clamp(Math.round(element.fontSize * 0.85), 10, 180);
    message = message || "已缩小文字";
  }

  if (includesAny(instruction, ["加粗", "粗一点", "变粗"])) {
    patch.fontWeight = clamp(element.fontWeight + 100, 100, 900);
    message = message || "已加粗文字";
  }

  if (includesAny(instruction, ["变细", "细一点", "取消加粗"])) {
    patch.fontWeight = clamp(element.fontWeight - 100, 100, 900);
    message = message || "已调细文字";
  }

  for (const [keywords, color] of textColorMap) {
    if (includesAny(instruction, keywords)) {
      patch.color = color;
      message = message || "已更新文字颜色";
      break;
    }
  }

  if (instruction.includes("居中")) {
    patch.x = Math.round((CANVAS_SIZE - element.width) / 2);
    patch.y = Math.round((CANVAS_SIZE - element.height) / 2);
    message = message || "已将文字居中";
  }

  return Object.keys(patch).length ? { patch, message } : null;
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneDoc(doc: CanvasDocument): CanvasDocument {
  return JSON.parse(JSON.stringify(doc)) as CanvasDocument;
}

function docsEqual(a: CanvasDocument, b: CanvasDocument) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function normalizeCanvasData(data: unknown): CanvasDocument {
  if (!data || typeof data !== "object") return emptyDocument;
  const maybeDoc = data as Partial<CanvasDocument>;
  return {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    background: isTransparentCanvasBackground(maybeDoc.background) ? "transparent" : maybeDoc.background || "transparent",
    elements: Array.isArray(maybeDoc.elements) ? maybeDoc.elements : [],
  };
}

function isTransparentCanvasBackground(background?: string) {
  const value = background?.trim().toLowerCase();
  return !value || value === "transparent" || value === "#fff" || value === "#ffffff" || value === "white";
}

function paintDocumentBackground(context: CanvasRenderingContext2D, background: string) {
  if (isTransparentCanvasBackground(background)) return;
  context.fillStyle = background;
  context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
}

function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

async function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function renderDocumentToDataUrl(doc: CanvasDocument, maxSize = CANVAS_SIZE) {
  const scale = maxSize / CANVAS_SIZE;
  const canvas = document.createElement("canvas");
  canvas.width = maxSize;
  canvas.height = maxSize;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建画布");

  context.scale(scale, scale);
  paintDocumentBackground(context, doc.background);

  for (const element of doc.elements) {
    context.save();
    context.translate(element.x + element.width / 2, element.y + element.height / 2);
    context.rotate((element.rotation * Math.PI) / 180);

    if (element.type === "image") {
      const image = await loadImage(element.src);
      context.drawImage(image, -element.width / 2, -element.height / 2, element.width, element.height);
    } else {
      context.fillStyle = element.color;
      context.font = `${element.fontWeight} ${element.fontSize}px sans-serif`;
      context.textBaseline = "top";
      const lines = element.content.split("\n");
      lines.forEach((line, index) => {
        context.fillText(line, -element.width / 2, -element.height / 2 + index * element.fontSize * 1.15, element.width);
      });
    }

    context.restore();
  }

  return canvas.toDataURL("image/png");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isEditableTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    (target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT" ||
      target.isContentEditable)
  );
}

function getLayerName(element: CanvasElement, fallbackIndex: number) {
  if (element.type === "text") {
    const content = element.content.trim().split("\n")[0];
    return content ? content.slice(0, 18) : `文本图层 ${fallbackIndex}`;
  }
  return element.label || materialRoleMap.get(element.role || "other")?.label || `图片图层 ${fallbackIndex}`;
}

function getMaterialRoleLabel(role?: PortraitReferenceRole) {
  return materialRoleMap.get(role || "other")?.label || "其他";
}

function loadImageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图片读取失败，请换一张图片重试"));
    image.src = dataUrl;
  });
}

function getFittedImageFrame(width: number, height: number, maxSize = DEFAULT_IMAGE_FRAME_SIZE) {
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  const scale = Math.min(1, maxSize / Math.max(safeWidth, safeHeight));
  const fittedWidth = Math.max(MIN_ELEMENT_SIZE, Math.round(safeWidth * scale));
  const fittedHeight = Math.max(MIN_ELEMENT_SIZE, Math.round(safeHeight * scale));
  return {
    width: fittedWidth,
    height: fittedHeight,
    x: Math.round((CANVAS_SIZE - fittedWidth) / 2),
    y: Math.round((CANVAS_SIZE - fittedHeight) / 2),
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("图片读取失败，请换一张图片重试"));
    reader.readAsDataURL(file);
  });
}

async function compressReferenceImage(file: File) {
  const dataUrl = await readFileAsDataUrl(file);
  const image = await loadImageFromDataUrl(dataUrl);
  const maxSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
  if (maxSide <= MAX_REFERENCE_IMAGE_SIZE && file.size <= 2 * 1024 * 1024) {
    return dataUrl;
  }

  const scale = Math.min(1, MAX_REFERENCE_IMAGE_SIZE / maxSide);
  const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
  const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("无法处理这张图片，请换一张图片重试");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", REFERENCE_IMAGE_QUALITY);
}

function getResizePatch(origin: CanvasElement, handle: ResizeHandle, dx: number, dy: number, lockAspect = false) {
  const angle = (origin.rotation * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const localDx = dx * cos + dy * sin;
  const localDy = -dx * sin + dy * cos;
  const affectsLeft = handle.includes("w");
  const affectsRight = handle.includes("e");
  const affectsTop = handle.includes("n");
  const affectsBottom = handle.includes("s");
  const requestedWidth = origin.width + (affectsRight ? localDx : 0) + (affectsLeft ? -localDx : 0);
  const requestedHeight = origin.height + (affectsBottom ? localDy : 0) + (affectsTop ? -localDy : 0);
  let width = Math.round(clamp(requestedWidth, MIN_ELEMENT_SIZE, MAX_ELEMENT_SIZE));
  let height = Math.round(clamp(requestedHeight, MIN_ELEMENT_SIZE, MAX_ELEMENT_SIZE));
  if (lockAspect && origin.width > 0 && origin.height > 0) {
    const aspect = origin.width / origin.height;
    const widthChangeRatio = Math.abs(width - origin.width) / origin.width;
    const heightChangeRatio = Math.abs(height - origin.height) / origin.height;
    const useWidth = (affectsLeft || affectsRight) && (!(affectsTop || affectsBottom) || widthChangeRatio >= heightChangeRatio);

    if (useWidth) {
      height = Math.round(clamp(width / aspect, MIN_ELEMENT_SIZE, MAX_ELEMENT_SIZE));
    } else {
      width = Math.round(clamp(height * aspect, MIN_ELEMENT_SIZE, MAX_ELEMENT_SIZE));
    }
  }
  const appliedWidthDelta = width - origin.width;
  const appliedHeightDelta = height - origin.height;
  const centerX = origin.x + origin.width / 2;
  const centerY = origin.y + origin.height / 2;
  const horizontalSign = affectsRight ? 1 : affectsLeft ? -1 : 0;
  const verticalSign = affectsBottom ? 1 : affectsTop ? -1 : 0;
  const nextCenterX = centerX + (cos * horizontalSign * appliedWidthDelta) / 2 + (-sin * verticalSign * appliedHeightDelta) / 2;
  const nextCenterY = centerY + (sin * horizontalSign * appliedWidthDelta) / 2 + (cos * verticalSign * appliedHeightDelta) / 2;

  return {
    width,
    height,
    x: Math.round(nextCenterX - width / 2),
    y: Math.round(nextCenterY - height / 2),
  };
}

function normalizeRotation(value: number) {
  const rotation = Math.round(value % 360);
  return rotation < -180 ? rotation + 360 : rotation > 180 ? rotation - 360 : rotation;
}

function buildCanvasFallbackPrompt(instruction: string) {
  return [
    "请根据这张画布参考图生成一张自然、真实、精修质感的 AI 写真照。",
    "画布中包含人物、服装、鞋子、饰品或背景等素材位置参考，请理解为生成参考，不要做成拼贴海报。",
    "用户成片要求：",
    instruction,
  ].join("\n");
}

function getSnappedPosition(
  activeElement: CanvasElement,
  nextX: number,
  nextY: number,
  elements: CanvasElement[],
  activeId: string,
  snapEnabled: boolean
) {
  if (!snapEnabled) {
    return { x: nextX, y: nextY, guides: [] as SnapGuide[] };
  }

  const verticalCandidates = [
    { position: 0, kind: "canvas" },
    { position: CANVAS_SIZE / 2, kind: "canvas" },
    { position: CANVAS_SIZE, kind: "canvas" },
  ];

  const horizontalCandidates = [
    { position: 0, kind: "canvas" },
    { position: CANVAS_SIZE / 2, kind: "canvas" },
    { position: CANVAS_SIZE, kind: "canvas" },
  ];

  elements.forEach((element) => {
    if (element.id === activeId) return;
    verticalCandidates.push(
      { position: element.x, kind: "element" },
      { position: element.x + element.width / 2, kind: "element" },
      { position: element.x + element.width, kind: "element" }
    );
    horizontalCandidates.push(
      { position: element.y, kind: "element" },
      { position: element.y + element.height / 2, kind: "element" },
      { position: element.y + element.height, kind: "element" }
    );
  });

  let bestX = nextX;
  let bestY = nextY;
  const guides: SnapGuide[] = [];

  const movingVerticalPoints = [
    { key: "left", value: nextX },
    { key: "center", value: nextX + activeElement.width / 2 },
    { key: "right", value: nextX + activeElement.width },
  ];

  const movingHorizontalPoints = [
    { key: "top", value: nextY },
    { key: "center", value: nextY + activeElement.height / 2 },
    { key: "bottom", value: nextY + activeElement.height },
  ];

  let bestVerticalMatch: VerticalMatch | null = null;
  let bestHorizontalMatch: HorizontalMatch | null = null;

  for (const point of movingVerticalPoints) {
    for (const candidate of verticalCandidates) {
      const distance = Math.abs(candidate.position - point.value);
      if (distance <= SNAP_TOLERANCE && (!bestVerticalMatch || distance < bestVerticalMatch.distance)) {
        bestVerticalMatch = {
          candidate: candidate.position,
          key: point.key as "left" | "center" | "right",
          distance,
        };
      }
    }
  }

  for (const point of movingHorizontalPoints) {
    for (const candidate of horizontalCandidates) {
      const distance = Math.abs(candidate.position - point.value);
      if (distance <= SNAP_TOLERANCE && (!bestHorizontalMatch || distance < bestHorizontalMatch.distance)) {
        bestHorizontalMatch = {
          candidate: candidate.position,
          key: point.key as "top" | "center" | "bottom",
          distance,
        };
      }
    }
  }

  if (bestVerticalMatch) {
    if (bestVerticalMatch.key === "left") bestX = bestVerticalMatch.candidate;
    if (bestVerticalMatch.key === "center") bestX = bestVerticalMatch.candidate - activeElement.width / 2;
    if (bestVerticalMatch.key === "right") bestX = bestVerticalMatch.candidate - activeElement.width;
    guides.push({ orientation: "vertical", position: bestVerticalMatch.candidate });
  }

  if (bestHorizontalMatch) {
    if (bestHorizontalMatch.key === "top") bestY = bestHorizontalMatch.candidate;
    if (bestHorizontalMatch.key === "center") bestY = bestHorizontalMatch.candidate - activeElement.height / 2;
    if (bestHorizontalMatch.key === "bottom") bestY = bestHorizontalMatch.candidate - activeElement.height;
    guides.push({ orientation: "horizontal", position: bestHorizontalMatch.candidate });
  }

  return {
    x: bestX,
    y: bestY,
    guides,
  };
}

function getCanvasElementsBounds(elements: CanvasElement[]) {
  if (elements.length === 0) return null;
  const left = Math.min(...elements.map((element) => element.x));
  const top = Math.min(...elements.map((element) => element.y));
  const right = Math.max(...elements.map((element) => element.x + element.width));
  const bottom = Math.max(...elements.map((element) => element.y + element.height));
  return {
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  };
}

function normalizeRect(start: Point, current: Point) {
  const left = Math.min(start.x, current.x);
  const top = Math.min(start.y, current.y);
  const right = Math.max(start.x, current.x);
  const bottom = Math.max(start.y, current.y);
  return { x: left, y: top, width: right - left, height: bottom - top, right, bottom };
}

function rectIntersectsElement(rect: ReturnType<typeof normalizeRect>, element: CanvasElement) {
  return (
    rect.x <= element.x + element.width &&
    rect.right >= element.x &&
    rect.y <= element.y + element.height &&
    rect.bottom >= element.y
  );
}

function uniqueIds(ids: string[]) {
  return Array.from(new Set(ids));
}

function getImageAspectLocked(element: CanvasElement) {
  return element.type === "image" && element.lockAspect !== false;
}

export default function EditorPage() {
  const router = useRouter();
  const [title, setTitle] = useState(DEFAULT_PROJECT_TITLE);
  const [canvasId, setCanvasId] = useState<number | null>(null);
  const [doc, setDoc] = useState<CanvasDocument>(emptyDocument);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [canvasList, setCanvasList] = useState<CanvasData[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [stageScale, setStageScale] = useState(0.59);
  const [workspacePan, setWorkspacePan] = useState<Point>({ x: 0, y: 0 });
  const [workspacePanDrag, setWorkspacePanDrag] = useState<WorkspacePanState | null>(null);
  const [marquee, setMarquee] = useState<MarqueeState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsAutoDismissing, setSettingsAutoDismissing] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [assistantCollapsed, setAssistantCollapsed] = useState(false);
  const [materialPanelOpen, setMaterialPanelOpen] = useState(true);
  const snapEnabled = true;
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const [quality, setQuality] = useState("中");
  const [ratio, setRatio] = useState("1:1");
  const [standardRatio, setStandardRatio] = useState("2:3");
  const [mobileRatio, setMobileRatio] = useState("9:16");
  const [imageCount, setImageCount] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [aiProcessing, setAiProcessing] = useState(false);
  const [pendingUploadRole, setPendingUploadRole] = useState<PortraitReferenceRole>("other");
  const [drag, setDrag] = useState<TransformState | null>(null);
  const [history, setHistory] = useState<HistoryState>({ past: [], future: [] });
  const [authReady, setAuthReady] = useState(false);
  const [quota, setQuota] = useState<{ total: number; used: number; remaining: number } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const promptInputRef = useRef<HTMLTextAreaElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const projectMenuRef = useRef<HTMLDivElement>(null);
  const docRef = useRef(doc);
  const settingsFadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settingsCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  useEffect(() => {
    let mounted = true;
    void getSession()
      .then((session) => {
        if (!mounted) return;
        if (!session) {
          window.location.assign("/login?next=/editor");
          return;
        }
        setAuthReady(true);
        void getUserProfile()
          .then((profile) => {
            const userProfile = profile as { quota: { total: number; used: number; remaining: number } };
            if (mounted) setQuota(userProfile.quota);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (mounted) window.location.assign("/login?next=/editor");
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  const clearSettingsDismissTimers = useCallback(() => {
    if (settingsFadeTimerRef.current) {
      clearTimeout(settingsFadeTimerRef.current);
      settingsFadeTimerRef.current = null;
    }
    if (settingsCloseTimerRef.current) {
      clearTimeout(settingsCloseTimerRef.current);
      settingsCloseTimerRef.current = null;
    }
  }, []);

  const scheduleSettingsDismiss = useCallback(() => {
    clearSettingsDismissTimers();
    settingsFadeTimerRef.current = setTimeout(() => setSettingsAutoDismissing(true), 3000);
    settingsCloseTimerRef.current = setTimeout(() => {
      setSettingsOpen(false);
      setSettingsAutoDismissing(false);
    }, 3700);
  }, [clearSettingsDismissTimers]);

  const openSettingsPanel = useCallback(() => {
    setSettingsOpen(true);
    setSettingsAutoDismissing(false);
    scheduleSettingsDismiss();
  }, [scheduleSettingsDismiss]);

  const closeSettingsPanel = useCallback(() => {
    clearSettingsDismissTimers();
    setSettingsOpen(false);
    setSettingsAutoDismissing(false);
  }, [clearSettingsDismissTimers]);

  const toggleSettingsPanel = useCallback(() => {
    if (settingsOpen) {
      closeSettingsPanel();
      return;
    }
    openSettingsPanel();
  }, [closeSettingsPanel, openSettingsPanel, settingsOpen]);

  const resetSettingsDismissTimer = useCallback(() => {
    if (!settingsOpen) return;
    setSettingsAutoDismissing(false);
    scheduleSettingsDismiss();
  }, [scheduleSettingsDismiss, settingsOpen]);

  useEffect(() => () => clearSettingsDismissTimers(), [clearSettingsDismissTimers]);

  useEffect(() => {
    if (!authReady) return;

    try {
      if (localStorage.getItem(EDITOR_SETTINGS_SEEN_KEY) !== "1") {
        localStorage.setItem(EDITOR_SETTINGS_SEEN_KEY, "1");
        openSettingsPanel();
      }
    } catch {
      openSettingsPanel();
    }
  }, [authReady, openSettingsPanel]);

  const activeElement = useMemo(
    () => doc.elements.find((element) => element.id === activeId) || null,
    [activeId, doc.elements]
  );

  const selectedElements = useMemo(
    () => doc.elements.filter((element) => selectedElementIds.includes(element.id)),
    [doc.elements, selectedElementIds]
  );

  const selectedReferenceImages = useMemo(
    () =>
      selectedElements
        .filter((element): element is Extract<CanvasElement, { type: "image" }> => element.type === "image")
        .map((element, index) => ({
          element,
          imageUrl: element.src,
          layerId: element.id,
          label: `reference_${index + 1}`,
          displayLabel: `参考图 ${index + 1}`,
          role: element.role || "other",
          roleLabel: getMaterialRoleLabel(element.role),
        })),
    [selectedElements]
  );

  const selectedBounds = useMemo(() => getCanvasElementsBounds(selectedElements), [selectedElements]);

  const layerItems = useMemo(
    () => doc.elements.map((element, index) => ({ element, index })).reverse(),
    [doc.elements]
  );

  const imageMaterials = useMemo(
    () => doc.elements.filter((element): element is Extract<CanvasElement, { type: "image" }> => element.type === "image"),
    [doc.elements]
  );

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  const refreshCanvasList = useCallback(async () => {
    try {
      const data = await getCanvasList(30, 0);
      setCanvasList(data.items);
    } catch {
      setCanvasList([]);
    }
  }, []);

  const toggleProjectMenu = useCallback(() => {
    setProjectMenuOpen((open) => {
      if (!open) void refreshCanvasList();
      return !open;
    });
  }, [refreshCanvasList]);

  useEffect(() => {
    if (!projectMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (projectMenuRef.current?.contains(event.target as Node)) return;
      setProjectMenuOpen(false);
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProjectMenuOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [projectMenuOpen]);

  useEffect(() => {
    refreshCanvasList();
  }, [refreshCanvasList]);

  useEffect(() => {
    const node = stageWrapRef.current;
    if (!node) return;

    const updateScale = () => {
      const maxCanvas = Math.min(node.clientWidth * 0.72, node.clientHeight * 0.72, 640);
      setStageScale(Math.max(MIN_STAGE_SCALE, maxCanvas / CANVAS_SIZE));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, [assistantCollapsed, authReady]);

  useEffect(() => {
    if (activeId && !doc.elements.some((element) => element.id === activeId)) {
      setActiveId(null);
    }
    setSelectedElementIds((current) => {
      const next = current.filter((id) => doc.elements.some((element) => element.id === id));
      return next.length === current.length ? current : next;
    });
  }, [activeId, doc.elements]);

  const pushHistorySnapshot = useCallback((snapshot: CanvasDocument) => {
    setHistory((current) => ({
      past: [...current.past, cloneDoc(snapshot)].slice(-HISTORY_LIMIT),
      future: [],
    }));
  }, []);

  const applyDocChange = useCallback(
    (updater: (current: CanvasDocument) => CanvasDocument) => {
      setDoc((current) => {
        const next = updater(current);
        if (next === current) return current;
        setHistory((historyState) => ({
          past: [...historyState.past, cloneDoc(current)].slice(-HISTORY_LIMIT),
          future: [],
        }));
        return next;
      });
    },
    []
  );

  const replaceDocument = useCallback((nextDoc: CanvasDocument, resetHistory = false) => {
    setDoc(cloneDoc(nextDoc));
    setSnapGuides([]);
    if (resetHistory) {
      setHistory({ past: [], future: [] });
    }
  }, []);

  const updateElement = useCallback(
    (id: string, patch: Partial<CanvasElement>, recordHistory = true) => {
      const updater = (current: CanvasDocument) => {
        const target = current.elements.find((element) => element.id === id);
        if (!target) return current;
        return {
          ...current,
          elements: current.elements.map((element) =>
            element.id === id ? ({ ...element, ...patch } as CanvasElement) : element
          ),
        };
      };

      if (recordHistory) {
        applyDocChange(updater);
      } else {
        setDoc(updater);
      }
    },
    [applyDocChange]
  );

  const selectElements = useCallback((ids: string[], active = ids[ids.length - 1] || null) => {
    const nextIds = uniqueIds(ids);
    setSelectedElementIds(nextIds);
    setActiveId(active && nextIds.includes(active) ? active : nextIds[nextIds.length - 1] || null);
  }, []);

  const toggleElementSelection = useCallback((id: string) => {
    setSelectedElementIds((current) => {
      const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
      setActiveId(next.includes(id) ? id : next[next.length - 1] || null);
      return next;
    });
  }, []);

  const addText = useCallback(
    (content = "输入文案") => {
      const element: CanvasElement = {
        id: createId(),
        type: "text",
        content,
        x: 180,
        y: 180,
        width: 560,
        height: 150,
        rotation: 0,
        fontSize: 64,
        color: "#1D1D1F",
        fontWeight: 600,
      };
      applyDocChange((current) => ({ ...current, elements: [...current.elements, element] }));
      selectElements([element.id], element.id);
      return element;
    },
    [applyDocChange, selectElements]
  );

  const addImage = useCallback(
    (
      src: string,
      role: PortraitReferenceRole = "other",
      label?: string,
      frame = getFittedImageFrame(DEFAULT_IMAGE_FRAME_SIZE, DEFAULT_IMAGE_FRAME_SIZE)
    ) => {
      const element: CanvasElement = {
        id: createId(),
        type: "image",
        src,
        role,
        label,
        x: frame.x,
        y: frame.y,
        width: frame.width,
        height: frame.height,
        rotation: 0,
        lockAspect: true,
      };
      applyDocChange((current) => ({ ...current, elements: [...current.elements, element] }));
      selectElements([element.id], element.id);
      return element;
    },
    [applyDocChange, selectElements]
  );

  const duplicateElement = useCallback(
    (id: string) => {
      const source = docRef.current.elements.find((element) => element.id === id);
      if (!source) return;

      const duplicated = {
        ...source,
        id: createId(),
        x: source.x + 28,
        y: source.y + 28,
      } as CanvasElement;

      applyDocChange((current) => ({ ...current, elements: [...current.elements, duplicated] }));
      selectElements([duplicated.id], duplicated.id);
      setMessage("已复制图层");
    },
    [applyDocChange, selectElements]
  );

  const duplicateSelectedElements = useCallback(() => {
    const ids = selectedElementIds.length ? selectedElementIds : activeId ? [activeId] : [];
    const selectedSet = new Set(ids);
    const sources = docRef.current.elements.filter((element) => selectedSet.has(element.id));
    if (sources.length === 0) return;
    if (sources.length === 1) {
      duplicateElement(sources[0].id);
      return;
    }

    const duplicated = sources.map(
      (source) =>
        ({
          ...source,
          id: createId(),
          x: source.x + 28,
          y: source.y + 28,
        }) as CanvasElement
    );
    applyDocChange((current) => ({ ...current, elements: [...current.elements, ...duplicated] }));
    selectElements(duplicated.map((element) => element.id), duplicated[duplicated.length - 1]?.id || null);
    setMessage(`已复制 ${duplicated.length} 个图层`);
  }, [activeId, applyDocChange, duplicateElement, selectElements, selectedElementIds]);

  const removeSelectedElements = useCallback(() => {
    const ids = selectedElementIds.length ? selectedElementIds : activeId ? [activeId] : [];
    if (ids.length === 0) return;
    const selectedSet = new Set(ids);
    applyDocChange((current) => ({
      ...current,
      elements: current.elements.filter((element) => !selectedSet.has(element.id)),
    }));
    selectElements([]);
    setMessage(ids.length > 1 ? `已删除 ${ids.length} 个图层` : "图层已删除");
  }, [activeId, applyDocChange, selectElements, selectedElementIds]);

  const removeActiveElement = removeSelectedElements;

  const moveElementLayer = useCallback(
    (id: string, delta: number) => {
      applyDocChange((current) => {
        const index = current.elements.findIndex((element) => element.id === id);
        if (index === -1) return current;
        const nextIndex = clamp(index + delta, 0, current.elements.length - 1);
        if (nextIndex === index) return current;
        const elements = [...current.elements];
        const [item] = elements.splice(index, 1);
        elements.splice(nextIndex, 0, item);
        return { ...current, elements };
      });
    },
    [applyDocChange]
  );

  const centerActiveElement = useCallback(
    (axis: Axis) => {
      const targets = selectedElements.length ? selectedElements : activeElement ? [activeElement] : [];
      const bounds = getCanvasElementsBounds(targets);
      if (!bounds) return;
      const dx = axis === "x" || axis === "both" ? Math.round((CANVAS_SIZE - bounds.width) / 2 - bounds.x) : 0;
      const dy = axis === "y" || axis === "both" ? Math.round((CANVAS_SIZE - bounds.height) / 2 - bounds.y) : 0;
      applyDocChange((current) => {
        const selectedSet = new Set(targets.map((element) => element.id));
        return {
          ...current,
          elements: current.elements.map((element) =>
            selectedSet.has(element.id) ? ({ ...element, x: element.x + dx, y: element.y + dy } as CanvasElement) : element
          ),
        };
      });
      setMessage("已对齐到画布中心");
    },
    [activeElement, applyDocChange, selectedElements]
  );

  const alignSelectedElements = useCallback(
    (align: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => {
      if (selectedElements.length < 2) return;
      const bounds = getCanvasElementsBounds(selectedElements);
      if (!bounds) return;
      const selectedSet = new Set(selectedElements.map((element) => element.id));
      applyDocChange((current) => ({
        ...current,
        elements: current.elements.map((element) => {
          if (!selectedSet.has(element.id)) return element;
          if (align === "left") return { ...element, x: bounds.x } as CanvasElement;
          if (align === "right") return { ...element, x: bounds.right - element.width } as CanvasElement;
          if (align === "centerX") return { ...element, x: Math.round(bounds.x + bounds.width / 2 - element.width / 2) } as CanvasElement;
          if (align === "top") return { ...element, y: bounds.y } as CanvasElement;
          if (align === "bottom") return { ...element, y: bounds.bottom - element.height } as CanvasElement;
          return { ...element, y: Math.round(bounds.y + bounds.height / 2 - element.height / 2) } as CanvasElement;
        }),
      }));
      setMessage("已对齐所选元素");
    },
    [applyDocChange, selectedElements]
  );

  const nudgeActiveElement = useCallback(
    (dx: number, dy: number) => {
      const ids = selectedElementIds.length ? selectedElementIds : activeId ? [activeId] : [];
      if (ids.length === 0) return;
      const selectedSet = new Set(ids);
      applyDocChange((current) => {
        return {
          ...current,
          elements: current.elements.map((element) =>
            selectedSet.has(element.id) ? ({ ...element, x: element.x + dx, y: element.y + dy } as CanvasElement) : element
          ),
        };
      });
    },
    [activeId, applyDocChange, selectedElementIds]
  );

  const resetCanvas = useCallback((keepProjectMenuOpen = false) => {
    setCanvasId(null);
    setTitle(DEFAULT_PROJECT_TITLE);
    replaceDocument(emptyDocument, true);
    selectElements([]);
    setMessage("已新建空白项目，保存后会出现在已保存项目里");
    setProjectMenuOpen(keepProjectMenuOpen);
    if (keepProjectMenuOpen) void refreshCanvasList();
  }, [refreshCanvasList, replaceDocument, selectElements]);

  const undo = useCallback(() => {
    if (!docRef.current || !canUndo) return;
    setHistory((current) => {
      if (!current.past.length) return current;
      const previous = current.past[current.past.length - 1];
      const currentSnapshot = cloneDoc(docRef.current);
      setDoc(cloneDoc(previous));
      return {
        past: current.past.slice(0, -1),
        future: [currentSnapshot, ...current.future].slice(0, HISTORY_LIMIT),
      };
    });
    setSnapGuides([]);
    setMessage("已撤销一步");
  }, [canUndo]);

  const redo = useCallback(() => {
    if (!docRef.current || !canRedo) return;
    setHistory((current) => {
      if (!current.future.length) return current;
      const [next, ...rest] = current.future;
      const currentSnapshot = cloneDoc(docRef.current);
      setDoc(cloneDoc(next));
      return {
        past: [...current.past, currentSnapshot].slice(-HISTORY_LIMIT),
        future: rest,
      };
    });
    setSnapGuides([]);
    setMessage("已恢复一步");
  }, [canRedo]);

  const handlePromptSend = useCallback(async () => {
    const instruction = prompt.trim();
    if (!instruction) {
      setMessage("请输入 AI 编辑指令");
      return;
    }
    if (aiProcessing) return;

    setAiProcessing(true);
    setMessage("");

    try {
      const referenceImages = selectedReferenceImages;
      const sourceMaterials = imageMaterials.filter((element) => !element.label?.startsWith("写真成片"));
      const requiredQuota = referenceImages.length > 0 || !activeElement ? imageCount : activeElement.type === "image" ? 1 : 0;
      if (quota && requiredQuota > 0 && quota.remaining < requiredQuota) {
        setMessage("当前图片生成额度已用完，请联系管理员升级权限。");
        return;
      }
      if (referenceImages.length > 0) {
        if (false && !sourceMaterials.some((element) => (element.role || "other") === "person")) {
          setMessage("请先上传并标记人物主体素材，再生成写真");
          return;
        }

        const references = referenceImages.map((item) => ({
          role: item.role,
          imageUrl: item.imageUrl,
          layerId: item.layerId,
          label: `${item.label} / ${item.roleLabel}`,
        }));

        let successCount = 0;
        for (let index = 1; index <= imageCount; index += 1) {
          const label = imageCount > 1 ? `写真成片 ${index}/${imageCount}` : "写真成片";
          try {
            setMessage(`正在生成写真 ${index}/${imageCount}...`);
            const result = await composePortrait({
              prompt: instruction,
              references,
              size: ratio,
              resolution: "1k",
              quality: normalizeEditorQuality(quality),
              model: "gpt-image-2",
            });
            setQuota((current) =>
              current ? { ...current, remaining: result.remaining_quota, used: current.total - result.remaining_quota } : current
            );
            addImage(result.url, "other", label);
            successCount += 1;
          } catch (composeError) {
            if (referenceImages.length > 0) throw composeError;
            try {
              setMessage(`第 ${index}/${imageCount} 张多素材生成未成功，正在使用当前画布合成图兜底...`);
              const canvasReference = await renderDocumentToDataUrl(docRef.current, 1024);
              const fallbackResult = await editImage({
                imageUrl: canvasReference,
                prompt: buildCanvasFallbackPrompt(instruction),
                size: ratio,
                resolution: "1k",
                quality: normalizeEditorQuality(quality),
                model: "gpt-image-2",
              });
              setQuota((current) =>
                current
                  ? { ...current, remaining: fallbackResult.remaining_quota, used: current.total - fallbackResult.remaining_quota }
                  : current
              );
              addImage(fallbackResult.url, "other", label);
              successCount += 1;
            } catch (fallbackError) {
              if (successCount > 0) {
                setPrompt("");
                setMessage(
                  `已生成 ${successCount}/${imageCount} 张写真，第 ${index} 张失败：${
                    fallbackError instanceof Error ? fallbackError.message : "请稍后重试"
                  }`
                );
                return;
              }
              throw composeError;
            }
          }
        }

        setPrompt("");
        setMessage(
          imageCount > 1 ? `已生成 ${successCount}/${imageCount} 张写真，并作为新图层放回画布` : "写真已生成，并作为新图层放回画布"
        );
        return;
      }

      if (!activeElement) {
        let successCount = 0;
        for (let index = 1; index <= imageCount; index += 1) {
          try {
            setMessage(`未选中图层，正在生成新图片 ${index}/${imageCount}...`);
            const result = await generateImage({
              prompt: instruction,
              size: ratio,
              resolution: "1k",
              quality: normalizeEditorQuality(quality),
              model: "gpt-image-2",
            });
            setQuota((current) =>
              current ? { ...current, remaining: result.remaining_quota, used: current.total - result.remaining_quota } : current
            );
            addImage(result.url, "other", imageCount > 1 ? `写真成片 ${index}/${imageCount}` : undefined);
            successCount += 1;
          } catch (error) {
            if (successCount > 0) {
              setPrompt("");
              setMessage(
                `已生成 ${successCount}/${imageCount} 张图片，第 ${index} 张失败：${
                  error instanceof Error ? error.message : "请稍后重试"
                }`
              );
              return;
            }
            throw error;
          }
        }
        setPrompt("");
        setMessage(imageCount > 1 ? `已生成并添加 ${successCount}/${imageCount} 个图片图层` : "已生成并添加图片图层");
        return;
      }

      if (includesAny(instruction, imageDeleteKeywords)) {
        removeActiveElement();
        setPrompt("");
        return;
      }

      if (activeElement.type === "image") {
        setMessage("已识别选中图片，正在执行 AI 编辑...");
        const result = await editImage({
          imageUrl: activeElement.src,
          prompt: getImageEditPrompt(instruction),
          size: ratio,
          resolution: "1k",
          quality: normalizeEditorQuality(quality),
          model: "gpt-image-2",
        });
        setQuota((current) =>
          current ? { ...current, remaining: result.remaining_quota, used: current.total - result.remaining_quota } : current
        );
        updateElement(activeElement.id, { src: result.url }, true);
        setPrompt("");
        setMessage("已替换选中图片");
        return;
      }

      const textEdit = buildTextPatch(instruction, activeElement);
      if (!textEdit) {
        setMessage("已识别选中文字，请使用更明确的文字编辑指令，例如：改成 周末限时特惠、字体放大一点、改成红色。");
        return;
      }

      updateElement(activeElement.id, textEdit.patch, true);
      setPrompt("");
      setMessage(textEdit.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI 编辑失败，请稍后重试");
    } finally {
      setAiProcessing(false);
    }
  }, [
    activeElement,
    addImage,
    aiProcessing,
    imageCount,
    imageMaterials,
    prompt,
    quality,
    quota,
    ratio,
    removeActiveElement,
    selectedReferenceImages,
    updateElement,
  ]);

  const handleImageUpload = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const input = event.currentTarget;
      const files = Array.from(input.files || []);
      const file = files[0];
      if (!file) return;

      if (files.some((item) => !["image/png", "image/jpeg", "image/webp"].includes(item.type))) {
        setMessage("仅支持 PNG、JPG、WEBP 图片");
        input.value = "";
        return;
      }

      if (files.some((item) => item.size > MAX_UPLOAD_BYTES)) {
        setMessage("图片不能超过 10MB");
        input.value = "";
        return;
      }

      try {
        const role = pendingUploadRole;
        setMessage("正在处理素材...");
        const addedIds: string[] = [];
        const imageUrl = await compressReferenceImage(file);
        const image = await loadImageFromDataUrl(imageUrl);
        const firstElement = addImage(
          imageUrl,
          role,
          getMaterialRoleLabel(role),
          getFittedImageFrame(image.naturalWidth || image.width, image.naturalHeight || image.height)
        );
        if (firstElement) addedIds.push(firstElement.id);
        for (const [index, extraFile] of files.slice(1).entries()) {
          const extraImageUrl = await compressReferenceImage(extraFile);
          const extraImage = await loadImageFromDataUrl(extraImageUrl);
          const frame = getFittedImageFrame(
            extraImage.naturalWidth || extraImage.width,
            extraImage.naturalHeight || extraImage.height
          );
          const offset = (index + 1) * 32;
          const extraElement = addImage(extraImageUrl, role, getMaterialRoleLabel(role), {
            ...frame,
            x: frame.x + offset,
            y: frame.y + offset,
          });
          if (extraElement) addedIds.push(extraElement.id);
        }
        selectElements(addedIds, addedIds[addedIds.length - 1] || null);
        setMessage(`${getMaterialRoleLabel(role)}素材已添加`);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "图片处理失败，请换一张图片重试");
      } finally {
        input.value = "";
      }
    },
    [addImage, pendingUploadRole, selectElements]
  );

  const startMaterialUpload = useCallback((role: PortraitReferenceRole) => {
    setPendingUploadRole(role);
    fileInputRef.current?.click();
  }, []);

  const renderToDataUrl = useCallback(
    async (maxSize = CANVAS_SIZE) => {
      const scale = maxSize / CANVAS_SIZE;
      const canvas = document.createElement("canvas");
      canvas.width = maxSize;
      canvas.height = maxSize;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("无法创建画布");

      context.scale(scale, scale);
      paintDocumentBackground(context, doc.background);

      for (const element of doc.elements) {
        context.save();
        context.translate(element.x + element.width / 2, element.y + element.height / 2);
        context.rotate((element.rotation * Math.PI) / 180);

        if (element.type === "image") {
          const image = await loadImage(element.src);
          context.drawImage(
            image,
            -element.width / 2,
            -element.height / 2,
            element.width,
            element.height
          );
        } else {
          context.fillStyle = element.color;
          context.font = `${element.fontWeight} ${element.fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", sans-serif`;
          context.textBaseline = "top";
          element.content.split("\n").forEach((line, index) => {
            context.fillText(
              line,
              -element.width / 2,
              -element.height / 2 + index * element.fontSize * 1.25
            );
          });
        }

        context.restore();
      }

      return canvas.toDataURL("image/png");
    },
    [doc]
  );

  const handleExport = useCallback(async () => {
    try {
      const dataUrl = await renderToDataUrl();
      downloadDataUrl(dataUrl, `${title || "lumina-canvas"}-${Date.now()}.png`);
    } catch {
      setMessage("导出失败，请确认图片可正常加载");
    }
  }, [renderToDataUrl, title]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage("");
    try {
      const thumbnail = await renderToDataUrl(360);
      const payload = doc as unknown as Record<string, unknown>;
      const safeTitle = title.trim() || DEFAULT_PROJECT_TITLE;
      const saved = canvasId
        ? await updateCanvas(canvasId, { title: safeTitle, canvas_data: payload, thumbnail })
        : await saveCanvas(safeTitle, payload, thumbnail);

      setCanvasId(saved.id);
      setTitle(saved.title);
      setMessage("画布已保存");
      await refreshCanvasList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }, [canvasId, doc, refreshCanvasList, renderToDataUrl, title]);

  const handleLoadCanvas = useCallback(
    async (id: number) => {
      try {
        const data = await getCanvas(id);
        setCanvasId(data.id);
        setTitle(data.title);
        replaceDocument(normalizeCanvasData(data.canvas_data), true);
        selectElements([]);
        setMessage("画布已打开");
        setProjectMenuOpen(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "打开失败");
      }
    },
    [replaceDocument, selectElements]
  );

  const clientToCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const rect = stageWrapRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: (clientX - rect.left - rect.width / 2 - workspacePan.x) / stageScale - WORKSPACE_ORIGIN,
        y: (clientY - rect.top - rect.height / 2 - workspacePan.y) / stageScale - WORKSPACE_ORIGIN,
      };
    },
    [stageScale, workspacePan.x, workspacePan.y]
  );

  const zoomWorkspace = useCallback((nextScale: number, pivot?: { clientX: number; clientY: number }) => {
    setStageScale((currentScale) => {
      const clampedScale = clamp(nextScale, MIN_STAGE_SCALE, MAX_STAGE_SCALE);
      if (!pivot || !stageWrapRef.current) return clampedScale;
      const rect = stageWrapRef.current.getBoundingClientRect();
      const pointerX = pivot.clientX - rect.left - rect.width / 2;
      const pointerY = pivot.clientY - rect.top - rect.height / 2;
      setWorkspacePan((currentPan) => ({
        x: pointerX - ((pointerX - currentPan.x) / currentScale) * clampedScale,
        y: pointerY - ((pointerY - currentPan.y) / currentScale) * clampedScale,
      }));
      return clampedScale;
    });
  }, []);

  const handleWorkspaceWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const factor = event.deltaY > 0 ? 0.92 : 1.08;
      zoomWorkspace(stageScale * factor, { clientX: event.clientX, clientY: event.clientY });
    },
    [stageScale, zoomWorkspace]
  );

  const handleWorkspacePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.target !== event.currentTarget && (event.target as HTMLElement).closest("[data-canvas-element]")) return;
      if (event.button !== 0 && event.button !== 1) return;
      event.preventDefault();

      const point = clientToCanvasPoint(event.clientX, event.clientY);
      const shouldPan = event.button === 1 || event.altKey;
      const shouldMarquee = event.button === 0 && !shouldPan;

      if (shouldMarquee) {
        setSnapGuides([]);
        let latestMarquee: MarqueeState = {
          start: point,
          current: point,
          additive: event.shiftKey || event.ctrlKey || event.metaKey,
          originIds: event.shiftKey || event.ctrlKey || event.metaKey ? selectedElementIds : [],
        };
        setMarquee(latestMarquee);
        if (!event.shiftKey && !event.ctrlKey && !event.metaKey) selectElements([]);

        const updateMarquee = (pointerEvent: PointerEvent) => {
          const current = clientToCanvasPoint(pointerEvent.clientX, pointerEvent.clientY);
          const rect = normalizeRect(point, current);
          const framedIds = docRef.current.elements
            .filter((element) => rectIntersectsElement(rect, element))
            .map((element) => element.id);
          const nextIds = latestMarquee.additive ? uniqueIds([...latestMarquee.originIds, ...framedIds]) : framedIds;
          latestMarquee = { ...latestMarquee, current };
          setMarquee(latestMarquee);
          selectElements(nextIds, nextIds[nextIds.length - 1] || null);
        };

        const finishMarquee = (pointerEvent: PointerEvent) => {
          updateMarquee(pointerEvent);
          const rect = normalizeRect(latestMarquee.start, latestMarquee.current);
          if (rect.width < 3 && rect.height < 3 && !latestMarquee.additive) {
            selectElements([]);
          }
          setMarquee(null);
          window.removeEventListener("pointermove", updateMarquee);
          window.removeEventListener("pointerup", finishMarquee);
          window.removeEventListener("pointercancel", finishMarquee);
        };

        window.addEventListener("pointermove", updateMarquee);
        window.addEventListener("pointerup", finishMarquee);
        window.addEventListener("pointercancel", finishMarquee);
        return;
      }

      setWorkspacePanDrag({
        startX: event.clientX,
        startY: event.clientY,
        origin: workspacePan,
        moved: false,
      });
    },
    [clientToCanvasPoint, selectElements, selectedElementIds, workspacePan]
  );

  useEffect(() => {
    if (!workspacePanDrag) return;

    const handleMove = (event: PointerEvent) => {
      const dx = event.clientX - workspacePanDrag.startX;
      const dy = event.clientY - workspacePanDrag.startY;
      setWorkspacePan({
        x: workspacePanDrag.origin.x + dx,
        y: workspacePanDrag.origin.y + dy,
      });
      setWorkspacePanDrag((current) => (current ? { ...current, moved: current.moved || Math.abs(dx) > 2 || Math.abs(dy) > 2 } : current));
    };

    const handleUp = () => {
      if (!workspacePanDrag.moved) selectElements([]);
      setWorkspacePanDrag(null);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [selectElements, workspacePanDrag]);

  const beginElementTransform = useCallback(
    (
      event: React.PointerEvent<HTMLElement>,
      element: CanvasElement,
      mode: TransformState["mode"],
      handle?: ResizeHandle
    ) => {
      event.stopPropagation();
      event.preventDefault();
      if ((event.shiftKey || event.ctrlKey || event.metaKey) && mode === "move") {
        toggleElementSelection(element.id);
        return;
      }

      const ids = mode === "move" && selectedElementIds.includes(element.id) ? selectedElementIds : [element.id];
      if (!selectedElementIds.includes(element.id) || selectedElementIds.length !== ids.length) {
        selectElements(ids, element.id);
      } else {
        setActiveId(element.id);
      }

      const node = (event.currentTarget as HTMLElement).closest("[data-canvas-element]");
      const rect = node?.getBoundingClientRect();
      const centerClientX = rect ? rect.left + rect.width / 2 : event.clientX;
      const centerClientY = rect ? rect.top + rect.height / 2 : event.clientY;

      setDrag({
        id: element.id,
        ids,
        mode,
        handle,
        startX: event.clientX,
        startY: event.clientY,
        origin: { ...element } as CanvasElement,
        origins: Object.fromEntries(
          docRef.current.elements.filter((item) => ids.includes(item.id)).map((item) => [item.id, { ...item } as CanvasElement])
        ),
        snapshot: cloneDoc(docRef.current),
        centerClientX,
        centerClientY,
        startAngle: Math.atan2(event.clientY - centerClientY, event.clientX - centerClientX),
        startRotation: element.rotation,
      });
    },
    [selectElements, selectedElementIds, toggleElementSelection]
  );

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      const active = docRef.current.elements.find((element) => element.id === drag.id);
      if (!active) return;

      const dx = (event.clientX - drag.startX) / stageScale;
      const dy = (event.clientY - drag.startY) / stageScale;

      if (drag.mode === "move") {
        if (drag.ids.length > 1) {
          const selectedSet = new Set(drag.ids);
          setSnapGuides([]);
          setDoc((current) => ({
            ...current,
            elements: current.elements.map((element) => {
              const origin = drag.origins[element.id];
              return selectedSet.has(element.id) && origin
                ? ({ ...element, x: Math.round(origin.x + dx), y: Math.round(origin.y + dy) } as CanvasElement)
                : element;
            }),
          }));
          return;
        }

        const rawX = drag.origin.x + dx;
        const rawY = drag.origin.y + dy;
        const snapped = getSnappedPosition(active, rawX, rawY, docRef.current.elements, drag.id, snapEnabled);

        setSnapGuides(snapped.guides);
        updateElement(
          drag.id,
          {
            x: snapped.x,
            y: snapped.y,
          },
          false
        );
        return;
      }

      setSnapGuides([]);

      if (drag.mode === "resize" && drag.handle) {
        updateElement(drag.id, getResizePatch(drag.origin, drag.handle, dx, dy, getImageAspectLocked(drag.origin)), false);
        return;
      }

      if (drag.mode === "rotate" && drag.centerClientX && drag.centerClientY && drag.startAngle !== undefined) {
        const currentAngle = Math.atan2(event.clientY - drag.centerClientY, event.clientX - drag.centerClientX);
        const angleDelta = ((currentAngle - drag.startAngle) * 180) / Math.PI;
        updateElement(drag.id, { rotation: normalizeRotation((drag.startRotation || 0) + angleDelta) }, false);
      }
    };

    const handleUp = () => {
      if (!drag) return;
      if (!docsEqual(drag.snapshot, docRef.current)) {
        pushHistorySnapshot(drag.snapshot);
      }
      setDrag(null);
      setSnapGuides([]);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [drag, pushHistorySnapshot, snapEnabled, stageScale, updateElement]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      const meta = event.metaKey || event.ctrlKey;

      if (meta && key === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          redo();
        } else {
          undo();
        }
        return;
      }

      if (meta && key === "y") {
        event.preventDefault();
        redo();
        return;
      }

      if (meta && key === "s") {
        event.preventDefault();
        void handleSave();
        return;
      }

      if (meta && key === "d") {
        event.preventDefault();
        duplicateSelectedElements();
        return;
      }

      if (!meta && key === "c" && !isEditableTarget(event.target)) {
        event.preventDefault();
        promptInputRef.current?.focus();
        return;
      }

      if (isEditableTarget(event.target)) return;

      if ((event.key === "Delete" || event.key === "Backspace") && (activeId || selectedElementIds.length > 0)) {
        event.preventDefault();
        removeSelectedElements();
        return;
      }

      if (!activeId && selectedElementIds.length === 0) return;

      const step = event.shiftKey ? 10 : 1;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        nudgeActiveElement(-step, 0);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        nudgeActiveElement(step, 0);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        nudgeActiveElement(0, -step);
      } else if (event.key === "ArrowDown") {
        event.preventDefault();
        nudgeActiveElement(0, step);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeId, duplicateSelectedElements, handleSave, nudgeActiveElement, redo, removeSelectedElements, selectedElementIds.length, undo]);

  return authReady ? (
    <div className="h-screen overflow-hidden bg-[#F7F7F8] text-[#1D1D1F]">
      <span className="sr-only" aria-live="polite">{message}</span>
      <header
        className={`absolute left-0 top-0 z-20 flex h-12 items-center justify-between px-4 ${
          assistantCollapsed ? "right-0" : "right-[360px]"
        }`}
      >
        <div ref={projectMenuRef} className="flex items-center gap-3">
          <button className="flex h-7 w-7 items-center justify-center rounded-full border border-black/10 bg-white shadow-sm">
            <BrandLogo className="h-5 w-5" />
          </button>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="项目名字"
            className="h-8 w-48 rounded-[9px] bg-transparent px-1 text-[15px] font-semibold outline-none hover:bg-white/70 focus:bg-white"
          />
          <button
            onClick={toggleProjectMenu}
            className="rounded-full p-1.5 text-[#8E8E93] hover:bg-white"
            title="项目菜单"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {projectMenuOpen && (
            <div className="absolute left-14 top-11 z-40 w-[300px] rounded-[18px] border border-black/10 bg-white p-2 shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
              <button
                onClick={() => resetCanvas(true)}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] text-[#1D1D1F] hover:bg-[#F5F5F7]"
              >
                <Plus className="h-4 w-4" />
                新建空白项目
              </button>

              <div className="my-2 h-px bg-black/5" />
              <div className="px-3 pb-1 text-[12px] font-medium text-[#8E8E93]">已保存项目</div>
              <div className="max-h-56 overflow-y-auto">
                {canvasList.length === 0 ? (
                  <p className="px-3 py-3 text-[13px] text-[#B3B3B8]">暂无保存项目，保存后会出现在这里</p>
                ) : (
                  canvasList.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLoadCanvas(item.id)}
                      className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left hover:bg-[#F5F5F7] ${
                        canvasId === item.id ? "text-[#007AFF]" : "text-[#1D1D1F]"
                      }`}
                    >
                      <span className="truncate text-[14px]">{item.title || DEFAULT_PROJECT_TITLE}</span>
                      <span className="ml-3 text-[12px] text-[#B3B3B8]">v{item.version}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="my-2 h-px bg-black/5" />
              <button
                onClick={refreshCanvasList}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] text-[#1D1D1F] hover:bg-[#F5F5F7]"
              >
                <RotateCcw className="h-4 w-4" />
                刷新项目
              </button>
              <button
                onClick={() => router.push("/studio")}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] text-[#D70015] hover:bg-[#FFF1F2]"
              >
                <LogOut className="h-4 w-4" />
                返回工作台
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 text-[12px] text-[#8E8E93]">
          <button
            onClick={() => router.push("/settings")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#007AFF] text-white"
            title="账户设置"
          >
            <Bot className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className={`grid h-full ${assistantCollapsed ? "grid-cols-1" : "grid-cols-[1fr_360px]"}`}>
        <section className="relative min-w-0 bg-[#F4F4F5]">
          {assistantCollapsed && (
            <button
              type="button"
              onClick={() => setAssistantCollapsed(false)}
              className="absolute right-4 top-14 z-30 rounded-full border border-black/10 bg-white px-4 py-2 text-[13px] font-medium text-[#1D1D1F] shadow-[0_8px_24px_rgba(0,0,0,0.10)] transition hover:bg-[#F5F5F7]"
            >
              展开素材
            </button>
          )}

          <div
            ref={stageWrapRef}
            className={`absolute inset-0 overflow-hidden ${
              workspacePanDrag ? "cursor-grabbing" : "cursor-crosshair"
            }`}
            style={{
              backgroundColor: "#F4F4F5",
              backgroundImage:
                "linear-gradient(rgba(29,29,31,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(29,29,31,0.045) 1px, transparent 1px)",
              backgroundSize: `${32 * stageScale}px ${32 * stageScale}px`,
              backgroundPosition: `${workspacePan.x}px ${workspacePan.y}px`,
            }}
            onPointerDownCapture={handleWorkspacePointerDown}
            onWheel={handleWorkspaceWheel}
          >
            <div
              className="absolute left-1/2 top-1/2 origin-center"
              style={{
                width: WORKSPACE_SIZE,
                height: WORKSPACE_SIZE,
                transform: `translate(-50%, -50%) translate(${workspacePan.x}px, ${workspacePan.y}px) scale(${stageScale})`,
              }}
            >
              <div
                className="absolute rounded-[4px] ring-1 ring-black/10"
                style={{
                  left: WORKSPACE_ORIGIN,
                  top: WORKSPACE_ORIGIN,
                  width: CANVAS_SIZE,
                  height: CANVAS_SIZE,
                  background: isTransparentCanvasBackground(doc.background) ? "transparent" : doc.background,
                  boxShadow: isTransparentCanvasBackground(doc.background)
                    ? "inset 0 0 0 1px rgba(255,255,255,0.7)"
                    : "0 18px 70px rgba(0,0,0,0.12)",
                }}
              >
                {snapGuides.map((guide, index) =>
                  guide.orientation === "vertical" ? (
                    <div
                      key={`v-${guide.position}-${index}`}
                      className="pointer-events-none absolute bottom-0 top-0 bg-[#007AFF]/65"
                      style={{
                        left: guide.position - 0.5 / stageScale,
                        width: 1 / stageScale,
                      }}
                    />
                  ) : (
                    <div
                      key={`h-${guide.position}-${index}`}
                      className="pointer-events-none absolute left-0 right-0 bg-[#007AFF]/65"
                      style={{
                        top: guide.position - 0.5 / stageScale,
                        height: 1 / stageScale,
                      }}
                    />
                  )
                )}
              </div>

              {doc.elements.map((element) => (
                <div
                  key={element.id}
                  data-canvas-element
                  onPointerDown={(event) => beginElementTransform(event, element, "move")}
                  className="absolute cursor-move select-none"
                  style={{
                    left: WORKSPACE_ORIGIN + element.x,
                    top: WORKSPACE_ORIGIN + element.y,
                    width: element.width,
                    height: element.height,
                    transform: `rotate(${element.rotation}deg)`,
                  }}
                >
                  {element.type === "image" ? (
                    <img src={element.src} alt="" draggable={false} className="h-full w-full object-fill" />
                  ) : (
                    <div
                      className="h-full w-full whitespace-pre-wrap leading-tight"
                      style={{
                        fontSize: element.fontSize,
                        color: element.color,
                        fontWeight: element.fontWeight,
                      }}
                    >
                      {element.content}
                    </div>
                  )}
                </div>
              ))}

              {selectedElements.map((element) => (
                <div
                  key={`selected-${element.id}`}
                  className="pointer-events-none absolute select-none"
                  style={{
                    left: WORKSPACE_ORIGIN + element.x,
                    top: WORKSPACE_ORIGIN + element.y,
                    width: element.width,
                    height: element.height,
                    transform: `rotate(${element.rotation}deg)`,
                    outline: `${2 / stageScale}px solid #007AFF`,
                    outlineOffset: 4 / stageScale,
                  }}
                />
              ))}

              {selectedBounds && selectedElements.length > 1 && (
                <div
                  className="pointer-events-none absolute border border-dashed border-[#007AFF]"
                  style={{
                    left: WORKSPACE_ORIGIN + selectedBounds.x,
                    top: WORKSPACE_ORIGIN + selectedBounds.y,
                    width: selectedBounds.width,
                    height: selectedBounds.height,
                  }}
                />
              )}

              {activeElement && selectedElements.length <= 1 && (
                <div
                  data-canvas-element
                  className="pointer-events-none absolute select-none"
                  style={{
                    left: WORKSPACE_ORIGIN + activeElement.x,
                    top: WORKSPACE_ORIGIN + activeElement.y,
                    width: activeElement.width,
                    height: activeElement.height,
                    transform: `rotate(${activeElement.rotation}deg)`,
                    outline: `${2 / stageScale}px solid #007AFF`,
                    outlineOffset: 4 / stageScale,
                  }}
                >
                  {resizeHandles.map((item) => (
                    <button
                      key={item.handle}
                      type="button"
                      aria-label={`调整${item.handle}`}
                      onPointerDown={(event) => beginElementTransform(event, activeElement, "resize", item.handle)}
                      className={`pointer-events-auto absolute z-10 rounded-full border-2 border-white bg-[#007AFF] shadow-[0_2px_8px_rgba(0,0,0,0.22)] ${item.className}`}
                      style={{
                        width: 14 / stageScale,
                        height: 14 / stageScale,
                        cursor: item.cursor,
                      }}
                    />
                  ))}
                  <div
                    className="pointer-events-none absolute left-1/2 bg-[#007AFF]"
                    style={{
                      top: -36 / stageScale,
                      width: 1 / stageScale,
                      height: 28 / stageScale,
                    }}
                  />
                  <button
                    type="button"
                    aria-label="旋转图层"
                    onPointerDown={(event) => beginElementTransform(event, activeElement, "rotate")}
                    className="pointer-events-auto absolute left-1/2 z-10 flex -translate-x-1/2 items-center justify-center rounded-full border-2 border-white bg-[#007AFF] shadow-[0_2px_8px_rgba(0,0,0,0.22)]"
                    style={{
                      top: -48 / stageScale,
                      width: 18 / stageScale,
                      height: 18 / stageScale,
                      cursor: "grab",
                    }}
                  />
                </div>
              )}

              {marquee && (
                <div
                  className="pointer-events-none absolute border border-[#007AFF] bg-[#007AFF]/10"
                  style={{
                    left: WORKSPACE_ORIGIN + normalizeRect(marquee.start, marquee.current).x,
                    top: WORKSPACE_ORIGIN + normalizeRect(marquee.start, marquee.current).y,
                    width: normalizeRect(marquee.start, marquee.current).width,
                    height: normalizeRect(marquee.start, marquee.current).height,
                  }}
                />
              )}
            </div>
          </div>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[16px] border border-black/10 bg-white/95 p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.14)] backdrop-blur">
            <ToolbarButton active icon={<MousePointer2 className="h-4 w-4" />} label="选择" />
            <ToolbarButton icon={<RotateCcw className="h-4 w-4" />} label="撤销" onClick={undo} disabled={!canUndo} />
            <ToolbarButton
              icon={<ArrowUp className="h-4 w-4 rotate-90" />}
              label="重做"
              onClick={redo}
              disabled={!canRedo}
            />
            <ToolbarButton icon={<ImagePlus className="h-4 w-4" />} label="图片" onClick={() => startMaterialUpload("other")} />
            <ToolbarButton icon={<Type className="h-4 w-4" />} label="文字" onClick={() => addText()} />
            <ToolbarButton icon={<Save className="h-4 w-4" />} label={saving ? "保存中" : "保存"} onClick={() => void handleSave()} />
            <ToolbarButton icon={<Download className="h-4 w-4" />} label="导出" onClick={() => void handleExport()} />
          </div>

          <div className="absolute bottom-4 left-4 z-20 flex items-center gap-1 rounded-[14px] border border-black/10 bg-white/95 p-1.5 text-[12px] font-medium text-[#3A3A3C] shadow-[0_10px_35px_rgba(0,0,0,0.12)] backdrop-blur">
            <button
              type="button"
              onClick={() => zoomWorkspace(stageScale / 1.15)}
              className="h-8 min-w-8 rounded-[10px] px-2 hover:bg-[#F5F5F7]"
            >
              -
            </button>
            <button
              type="button"
              onClick={() => {
                setStageScale(0.59);
                setWorkspacePan({ x: 0, y: 0 });
              }}
              className="h-8 rounded-[10px] px-3 hover:bg-[#F5F5F7]"
            >
              {Math.round(stageScale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomWorkspace(stageScale * 1.15)}
              className="h-8 min-w-8 rounded-[10px] px-2 hover:bg-[#F5F5F7]"
            >
              +
            </button>
          </div>

          {settingsOpen && (
            <div
              className={`absolute bottom-20 right-6 z-20 w-[310px] rounded-[18px] border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)] transition-all duration-700 ${
                settingsAutoDismissing ? "translate-y-2 opacity-0" : "translate-y-0 opacity-100"
              }`}
              onPointerDown={resetSettingsDismissTimer}
            >
              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-[#3A3A3C]">质量</p>
                <div className="grid grid-cols-4 rounded-[14px] bg-[#F5F5F7] p-1 text-[12px]">
                  {["自动", "高", "中", "低"].map((item) => (
                    <button
                      key={item}
                      onClick={() => {
                        setQuality(item);
                        resetSettingsDismissTimer();
                      }}
                      className={`h-8 rounded-[11px] ${
                        quality === item ? "bg-white shadow-sm" : "text-[#8E8E93]"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-[#3A3A3C]">尺寸</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="rounded-[9px] bg-[#F5F5F7] px-3 py-2 text-[13px] text-[#3A3A3C]">W 2048</div>
                  <span className="text-[#C7C7CC]">↔</span>
                  <div className="rounded-[9px] bg-[#F5F5F7] px-3 py-2 text-[13px] text-[#3A3A3C]">H 2048</div>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-[#3A3A3C]">宽高比</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => {
                      setRatio("1:1");
                      resetSettingsDismissTimer();
                    }}
                    className={`flex h-14 flex-col items-center justify-center rounded-[10px] border text-[12px] ${
                      ratio === "1:1" ? "border-[#D1D1D6] bg-[#F2F2F3]" : "border-[#E5E5EA] bg-white"
                    }`}
                  >
                    <Grid3X3 className="mb-1 h-4 w-4" />
                    1:1
                  </button>
                  <button
                    onClick={() => {
                      const nextRatio = standardRatio === "2:3" ? "3:2" : "2:3";
                      setStandardRatio(nextRatio);
                      setRatio(nextRatio);
                      resetSettingsDismissTimer();
                    }}
                    className={`flex h-14 flex-col items-center justify-center rounded-[10px] border text-[12px] ${
                      ratio === standardRatio ? "border-[#D1D1D6] bg-[#F2F2F3]" : "border-[#E5E5EA] bg-white"
                    }`}
                  >
                    <Grid3X3 className="mb-1 h-4 w-4" />
                    {standardRatio}
                  </button>
                  <button
                    onClick={() => {
                      const nextRatio = mobileRatio === "9:16" ? "16:9" : "9:16";
                      setMobileRatio(nextRatio);
                      setRatio(nextRatio);
                      resetSettingsDismissTimer();
                    }}
                    className={`flex h-14 flex-col items-center justify-center rounded-[10px] border text-[12px] ${
                      ratio === mobileRatio ? "border-[#D1D1D6] bg-[#F2F2F3]" : "border-[#E5E5EA] bg-white"
                    }`}
                  >
                    <Grid3X3 className="mb-1 h-4 w-4" />
                    {mobileRatio}
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-[#3A3A3C]">候选数量</p>
                <div className="grid grid-cols-3 gap-2">
                  {imageCountOptions.map((count) => (
                    <button
                      key={count}
                      onClick={() => {
                        setImageCount(count);
                        resetSettingsDismissTimer();
                      }}
                      className={`h-8 rounded-[9px] border text-[12px] ${
                        imageCount === count ? "border-[#D1D1D6] bg-[#F2F2F3]" : "border-[#E5E5EA] bg-white"
                      }`}
                    >
                      {count}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={handleImageUpload}
            className="hidden"
          />
        </section>

        {!assistantCollapsed && (
        <aside className="relative flex h-full flex-col border-l border-black/10 bg-white">
          <div className="flex h-12 items-center justify-between border-b border-black/5 px-4">
            <h1 className="text-[15px] font-semibold">AI 写真素材</h1>
            <button
              type="button"
              onClick={() => setAssistantCollapsed(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-[#C7C7CC] transition hover:bg-[#F5F5F7] hover:text-[#8E8E93]"
              title="收起助手"
              aria-label="收起助手"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-1 flex-col items-center justify-start overflow-y-auto px-6 pb-28 pt-8 text-center">
            <div className="mb-6 w-full rounded-[16px] border border-[#D9E7FF] bg-[#F8FBFF] p-3 text-left">
              <button
                type="button"
                onClick={() => setMaterialPanelOpen((open) => !open)}
                className="mb-3 flex w-full items-start justify-between gap-3 text-left"
              >
                <span>
                  <span className="block text-[14px] font-semibold text-[#1D1D1F]">写真素材积木</span>
                  <span className="mt-1 block text-[12px] leading-5 text-[#667085]">
                    上传人物、服装、鞋子、饰品和背景，拖到画布中组织参考关系。
                  </span>
                </span>
                <ChevronDown className={`mt-1 h-4 w-4 shrink-0 text-[#8E8E93] transition ${materialPanelOpen ? "rotate-180" : ""}`} />
              </button>
              {materialPanelOpen && (
                <div className="grid grid-cols-2 gap-2">
                  {materialRoles.map((item) => (
                    <button
                      key={item.role}
                      onClick={() => startMaterialUpload(item.role)}
                      className={`rounded-[12px] border px-3 py-2 text-left transition hover:border-[#007AFF] hover:bg-white ${
                        item.role === "person" ? "border-[#007AFF]/45 bg-white" : "border-black/5 bg-white/70"
                      }`}
                    >
                      <span className="block text-[13px] font-semibold text-[#1D1D1F]">{item.label}</span>
                      <span className="mt-0.5 block text-[11px] text-[#8E8E93]">{item.hint}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {false && (
              <>
            <div className="w-full rounded-[14px] border border-black/5 bg-[#FAFAFA] p-3 text-left">
                <div className="mb-2 flex items-center justify-between text-[13px] text-[#8E8E93]">
                  <span>图层面板</span>
                  <span>{doc.elements.length} 个</span>
                </div>
                <div className="max-h-48 space-y-1 overflow-y-auto">
                  {layerItems.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-[#B3B3B8]">还没有图层，先添加图片或文字</p>
                  ) : (
                    layerItems.map(({ element, index }) => {
                      const canMoveForward = index < doc.elements.length - 1;
                      const canMoveBackward = index > 0;
                      return (
                        <button
                          key={element.id}
                          onClick={() => selectElements([element.id], element.id)}
                          className={`flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition ${
                            activeId === element.id ? "bg-white shadow-sm" : "hover:bg-white"
                          }`}
                        >
                          <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[#F2F4F7] text-[#667085]">
                            {element.type === "image" ? (
                              <ImageIcon className="h-4 w-4" />
                            ) : (
                              <Type className="h-4 w-4" />
                            )}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-medium text-[#1D1D1F]">
                              {getLayerName(element, doc.elements.length - index)}
                            </p>
                            <p className="text-[12px] text-[#8E8E93]">
                              {Math.round(element.x)}, {Math.round(element.y)}
                            </p>
                            {element.type === "image" && (
                              <span className="mt-1 inline-flex rounded-full bg-[#EAF3FF] px-2 py-0.5 text-[11px] font-medium text-[#007AFF]">
                                {getMaterialRoleLabel(element.role)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                moveElementLayer(element.id, 1);
                              }}
                              disabled={!canMoveForward}
                              className="rounded-full p-1 text-[#8E8E93] hover:bg-[#F5F5F7] disabled:opacity-30"
                              title="上移一层"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </button>
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                moveElementLayer(element.id, -1);
                              }}
                              disabled={!canMoveBackward}
                              className="rounded-full p-1 text-[#8E8E93] hover:bg-[#F5F5F7] disabled:opacity-30"
                              title="下移一层"
                            >
                              <ArrowUp className="h-3.5 w-3.5 rotate-180" />
                            </button>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

            <div className="mt-6 w-full rounded-[14px] border border-black/5 bg-[#FAFAFA] p-3 text-left">
                <div className="mb-2 flex items-center justify-between text-[13px] text-[#8E8E93]">
                  <span>已保存画布</span>
                  <button onClick={refreshCanvasList} className="hover:text-[#007AFF]">刷新</button>
                </div>
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {canvasList.length === 0 ? (
                    <p className="py-4 text-center text-[13px] text-[#B3B3B8]">暂无保存记录</p>
                  ) : (
                    canvasList.slice(0, 6).map((item) => (
                      <button
                        key={item.id}
                        onClick={() => handleLoadCanvas(item.id)}
                        className="flex w-full items-center justify-between rounded-[9px] px-2 py-2 text-left hover:bg-white"
                      >
                        <span className="truncate text-[13px] text-[#3A3A3C]">{item.title}</span>
                        <span className="text-[12px] text-[#B3B3B8]">v{item.version}</span>
                      </button>
                    ))
                  )}
                </div>
              </div>
              </>
            )}

          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-black/5 bg-white p-4">
            {selectedElements.length > 1 && (
              <MultiSelectionInspector
                count={selectedElements.length}
                removeSelected={removeSelectedElements}
                duplicateSelected={duplicateSelectedElements}
                centerHorizontal={() => centerActiveElement("x")}
                centerVertical={() => centerActiveElement("y")}
                alignSelected={alignSelectedElements}
                groupSelected={() => setMessage("组合功能已预留，后续可扩展为真实分组")}
              />
            )}

            {activeElement && selectedElements.length <= 1 && (
              <ActiveInspector
                element={activeElement}
                updateElement={updateElement}
                removeActiveElement={removeActiveElement}
                duplicateElement={() => duplicateElement(activeElement.id)}
                centerHorizontal={() => centerActiveElement("x")}
                centerVertical={() => centerActiveElement("y")}
                moveForward={() => moveElementLayer(activeElement.id, 1)}
                moveBackward={() => moveElementLayer(activeElement.id, -1)}
              />
            )}

            <div className="rounded-[18px] border border-black/10 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              {selectedReferenceImages.length > 0 && (
                <div className="mb-2 rounded-[14px] bg-[#F5F8FF] p-2 text-left">
                  <div className="mb-2 flex items-center justify-between text-[12px] font-medium text-[#3A3A3C]">
                    <span>{`已加入 ${selectedReferenceImages.length} 张独立参考图`}</span>
                    <span className="text-[#8E8E93]">reference_1...</span>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {selectedReferenceImages.map((item) => (
                      <div
                        key={item.layerId}
                        className="group relative w-[78px] shrink-0 rounded-[10px] border border-[#D9E7FF] bg-white p-1"
                      >
                        <img src={item.imageUrl} alt={item.displayLabel} className="h-[58px] w-full rounded-[7px] object-cover" />
                        <div className="mt-1 truncate text-[11px] font-medium text-[#1D1D1F]">{item.displayLabel}</div>
                        <div className="truncate text-[10px] text-[#8E8E93]">{item.roleLabel}</div>
                        <button
                          type="button"
                          onClick={() => toggleElementSelection(item.layerId)}
                          className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded-full bg-black/70 text-[13px] leading-none text-white group-hover:flex"
                          aria-label={`移除${item.displayLabel}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <textarea
                ref={promptInputRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    event.preventDefault();
                    void handlePromptSend();
                  }
                }}
                placeholder="描述成片效果，如：韩系棚拍，保持脸不变，穿上当前单品"
                rows={3}
                disabled={aiProcessing}
                className="w-full resize-none rounded-[12px] px-3 py-2 text-[14px] outline-none"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={toggleSettingsPanel}
                  className="inline-flex items-center gap-2 rounded-full bg-[#F5F5F7] px-3 py-2 text-[13px] text-[#3A3A3C]"
                >
                  <ImagePlus className="h-4 w-4" /> 设置
                  <ChevronDown className={`h-3.5 w-3.5 transition ${settingsOpen ? "rotate-180" : ""}`} />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePromptSend}
                    disabled={aiProcessing || (!!quota && quota.remaining <= 0)}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[#1D1D1F] px-4 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {aiProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    生成
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
        )}
      </main>
    </div>
  ) : (
    <div className="flex h-screen items-center justify-center bg-[#F7F7F8] text-[#1D1D1F]">
      <div className="rounded-[18px] border border-black/5 bg-white px-6 py-5 text-center shadow-card">
        <BrandLogo className="mx-auto mb-3 h-8 w-8" />
        <p className="text-[15px] font-semibold">正在进入 AI 写真画布</p>
        <p className="mt-1 text-[13px] text-[#86868B]">如果未登录，将自动跳转到登录页</p>
      </div>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      disabled={disabled}
      className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${
        active ? "bg-[#1D1D1F] text-white" : "text-[#5C5C60] hover:bg-[#F5F5F7]"
      } ${disabled ? "cursor-not-allowed opacity-35 hover:bg-transparent" : ""}`}
    >
      {icon}
    </button>
  );
}

function MultiSelectionInspector({
  count,
  removeSelected,
  duplicateSelected,
  centerHorizontal,
  centerVertical,
  alignSelected,
  groupSelected,
}: {
  count: number;
  removeSelected: () => void;
  duplicateSelected: () => void;
  centerHorizontal: () => void;
  centerVertical: () => void;
  alignSelected: (align: "left" | "centerX" | "right" | "top" | "centerY" | "bottom") => void;
  groupSelected: () => void;
}) {
  return (
    <div className="mb-3 rounded-[14px] border border-[#D9E7FF] bg-[#F8FBFF] p-3 text-left">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1D1D1F]">已选中 {count} 个元素</span>
        <button onClick={removeSelected} className="rounded-full p-1 text-[#8E8E93] hover:bg-white">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-2 grid grid-cols-3 gap-2">
        <InspectorActionButton label="左对齐" onClick={() => alignSelected("left")} />
        <InspectorActionButton label="水平居中" onClick={() => alignSelected("centerX")} />
        <InspectorActionButton label="右对齐" onClick={() => alignSelected("right")} />
        <InspectorActionButton label="顶对齐" onClick={() => alignSelected("top")} />
        <InspectorActionButton label="垂直居中" onClick={() => alignSelected("centerY")} />
        <InspectorActionButton label="底对齐" onClick={() => alignSelected("bottom")} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InspectorActionButton label="居中到画板" onClick={centerHorizontal} />
        <InspectorActionButton label="垂直到画板" onClick={centerVertical} />
        <InspectorActionButton label="复制所选" onClick={duplicateSelected} />
        <InspectorActionButton label="组合" onClick={groupSelected} />
        <InspectorActionButton danger label="删除所选" onClick={removeSelected} />
      </div>
    </div>
  );
}

function ActiveInspector({
  element,
  updateElement,
  removeActiveElement,
  duplicateElement,
  centerHorizontal,
  centerVertical,
  moveForward,
  moveBackward,
}: {
  element: CanvasElement;
  updateElement: (id: string, patch: Partial<CanvasElement>, recordHistory?: boolean) => void;
  removeActiveElement: () => void;
  duplicateElement: () => void;
  centerHorizontal: () => void;
  centerVertical: () => void;
  moveForward: () => void;
  moveBackward: () => void;
}) {
  const aspectLocked = getImageAspectLocked(element);
  const updateSize = (dimension: "width" | "height", value: number) => {
    const nextValue = Math.max(MIN_ELEMENT_SIZE, value);
    if (element.type === "image" && aspectLocked && element.width > 0 && element.height > 0) {
      const aspect = element.width / element.height;
      updateElement(
        element.id,
        dimension === "width"
          ? { width: nextValue, height: Math.max(MIN_ELEMENT_SIZE, Math.round(nextValue / aspect)) }
          : { height: nextValue, width: Math.max(MIN_ELEMENT_SIZE, Math.round(nextValue * aspect)) }
      );
      return;
    }
    updateElement(element.id, { [dimension]: nextValue } as Partial<CanvasElement>);
  };

  return (
    <div className="mb-3 rounded-[14px] border border-black/5 bg-[#FAFAFA] p-3 text-left">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1D1D1F]">选中图层</span>
        <button onClick={removeActiveElement} className="rounded-full p-1 text-[#8E8E93] hover:bg-white">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {element.type === "image" && (
        <div className="mb-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <label className="block text-[11px] text-[#8E8E93]">素材类型</label>
            <button
              type="button"
              onClick={() => updateElement(element.id, { lockAspect: !aspectLocked } as Partial<CanvasElement>)}
              className={`inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium ${
                aspectLocked ? "bg-[#EAF3FF] text-[#007AFF]" : "bg-white text-[#8E8E93]"
              }`}
              title={aspectLocked ? "比例锁定" : "自由缩放"}
            >
              {aspectLocked ? <Lock className="h-3.5 w-3.5" /> : <Unlock className="h-3.5 w-3.5" />}
              {aspectLocked ? "比例锁定" : "自由缩放"}
            </button>
          </div>
          <select
            value={element.role || "other"}
            onChange={(event) => {
              const role = event.target.value as PortraitReferenceRole;
              updateElement(element.id, {
                role,
                label: element.label || getMaterialRoleLabel(role),
              } as Partial<CanvasElement>);
            }}
            className="h-9 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[13px] outline-none"
          >
            {materialRoles.map((item) => (
              <option key={item.role} value={item.role}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {element.type === "text" && (
        <>
          <textarea
            value={element.content}
            onChange={(event) => updateElement(element.id, { content: event.target.value })}
            className="mb-2 min-h-[64px] w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] outline-none"
          />
          <div className="mb-2 grid grid-cols-[1fr_auto] gap-2">
            <MiniNumber
              label="字"
              value={element.fontSize}
              min={10}
              onChange={(value) => updateElement(element.id, { fontSize: value })}
            />
            <label className="text-[11px] text-[#8E8E93]">
              色
              <input
                type="color"
                value={element.color}
                onChange={(event) => updateElement(element.id, { color: event.target.value })}
                className="mt-1 h-8 w-full rounded-[8px] border border-black/10 bg-white p-1"
              />
            </label>
          </div>
        </>
      )}

      <div className="mb-3 grid grid-cols-5 gap-2">
        <MiniNumber label="X" value={element.x} onChange={(value) => updateElement(element.id, { x: value })} />
        <MiniNumber label="Y" value={element.y} onChange={(value) => updateElement(element.id, { y: value })} />
        <MiniNumber label="W" value={element.width} min={40} onChange={(value) => updateSize("width", value)} />
        <MiniNumber label="H" value={element.height} min={40} onChange={(value) => updateSize("height", value)} />
        <MiniNumber label="R" value={element.rotation} onChange={(value) => updateElement(element.id, { rotation: value })} />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <InspectorActionButton label="水平居中" onClick={centerHorizontal} />
        <InspectorActionButton label="垂直居中" onClick={centerVertical} />
        <InspectorActionButton label="上移一层" onClick={moveForward} />
        <InspectorActionButton label="下移一层" onClick={moveBackward} />
        <InspectorActionButton label="复制图层" onClick={duplicateElement} />
        <InspectorActionButton danger label="删除图层" onClick={removeActiveElement} />
      </div>
    </div>
  );
}

function InspectorActionButton({
  label,
  onClick,
  danger,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[10px] border px-3 py-2 text-[12px] font-medium transition ${
        danger
          ? "border-[#FFD7D3] bg-[#FFF7F5] text-[#D70015] hover:bg-[#FFF1EF]"
          : "border-black/5 bg-white text-[#3A3A3C] hover:bg-[#F5F5F7]"
      }`}
    >
      {label}
    </button>
  );
}

function MiniNumber({
  label,
  value,
  onChange,
  min,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <label className="text-[11px] text-[#8E8E93]">
      {label}
      <input
        type="number"
        min={min}
        value={Math.round(value)}
        onChange={(event) => onChange(Math.max(min ?? Number.NEGATIVE_INFINITY, Number(event.target.value) || 0))}
        className="mt-1 h-8 w-full rounded-[8px] border border-black/10 bg-white px-2 text-[12px] text-[#1D1D1F] outline-none"
      />
    </label>
  );
}
