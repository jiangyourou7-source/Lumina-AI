"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUp,
  Bot,
  ChevronDown,
  Download,
  FolderOpen,
  Grid3X3,
  ImagePlus,
  Layers,
  LogOut,
  Maximize2,
  Mic,
  MousePointer2,
  PenLine,
  Plus,
  RotateCcw,
  Save,
  Send,
  Settings2,
  Share2,
  Square,
  Target,
  Trash2,
  Type,
  Wand2,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  CanvasData,
  getCanvas,
  getCanvasList,
  isAuthenticated,
  saveCanvas,
  updateCanvas,
} from "@/lib/openai-proxy";

const CANVAS_SIZE = 1080;

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

const emptyDocument: CanvasDocument = {
  width: CANVAS_SIZE,
  height: CANVAS_SIZE,
  background: "#FFFFFF",
  elements: [],
};

const DEFAULT_PROJECT_TITLE = "未命名项目";

const skills = [
  "广告创意",
  "Instagram Post",
  "一键跨平台适配",
  "产品卖点图",
  "网页变灵感",
  "所有 Skills",
];

const ratioOptions = ["1:1", "2:3", "3:2"];
const imageCountOptions = Array.from({ length: 10 }, (_, index) => index + 1);

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCanvasData(data: unknown): CanvasDocument {
  if (!data || typeof data !== "object") return emptyDocument;
  const maybeDoc = data as Partial<CanvasDocument>;
  return {
    width: CANVAS_SIZE,
    height: CANVAS_SIZE,
    background: maybeDoc.background || "#FFFFFF",
    elements: Array.isArray(maybeDoc.elements) ? maybeDoc.elements : [],
  };
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

export default function EditorPage() {
  const router = useRouter();
  const [title, setTitle] = useState(DEFAULT_PROJECT_TITLE);
  const [canvasId, setCanvasId] = useState<number | null>(null);
  const [doc, setDoc] = useState<CanvasDocument>(emptyDocument);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [canvasList, setCanvasList] = useState<CanvasData[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [stageScale, setStageScale] = useState(1);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const [quality, setQuality] = useState("低");
  const [ratio, setRatio] = useState("1:1");
  const [imageCount, setImageCount] = useState(1);
  const [prompt, setPrompt] = useState("");
  const [drag, setDrag] = useState<{
    id: string;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/editor");
    }
  }, [router]);

  const activeElement = useMemo(
    () => doc.elements.find((element) => element.id === activeId) || null,
    [activeId, doc.elements]
  );

  const refreshCanvasList = useCallback(async () => {
    try {
      const data = await getCanvasList(30, 0);
      setCanvasList(data.items);
    } catch {
      setCanvasList([]);
    }
  }, []);

  useEffect(() => {
    refreshCanvasList();
  }, [refreshCanvasList]);

  useEffect(() => {
    const node = stageWrapRef.current;
    if (!node) return;

    const updateScale = () => {
      const maxCanvas = Math.min(node.clientWidth * 0.72, node.clientHeight * 0.72, 640);
      setStageScale(Math.max(0.24, maxCanvas / CANVAS_SIZE));
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!drag) return;

    const handleMove = (event: PointerEvent) => {
      const dx = (event.clientX - drag.startX) / stageScale;
      const dy = (event.clientY - drag.startY) / stageScale;
      updateElement(drag.id, {
        x: Math.max(0, Math.min(CANVAS_SIZE - 40, drag.originX + dx)),
        y: Math.max(0, Math.min(CANVAS_SIZE - 40, drag.originY + dy)),
      });
    };

    const handleUp = () => setDrag(null);
    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
    };
  }, [drag, stageScale]);

  function updateElement(id: string, patch: Partial<CanvasElement>) {
    setDoc((current) => ({
      ...current,
      elements: current.elements.map((element) =>
        element.id === id ? ({ ...element, ...patch } as CanvasElement) : element
      ),
    }));
  }

  function addText(content = "输入文案") {
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
    setDoc((current) => ({ ...current, elements: [...current.elements, element] }));
    setActiveId(element.id);
  }

  function handlePromptSend() {
    if (!prompt.trim()) {
      setMessage("输入你的想法开始创作");
      return;
    }
    addText(prompt.trim());
    setPrompt("");
    setMessage("已添加到画布");
  }

  function handleImageUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setMessage("图片不能超过 10MB");
      return;
    }

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const element: CanvasElement = {
        id: createId(),
        type: "image",
        src: String(readerEvent.target?.result || ""),
        x: 170,
        y: 170,
        width: 640,
        height: 640,
        rotation: 0,
      };
      setDoc((current) => ({ ...current, elements: [...current.elements, element] }));
      setActiveId(element.id);
      setMessage("图片已添加");
    };
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  function removeActiveElement() {
    if (!activeId) return;
    setDoc((current) => ({
      ...current,
      elements: current.elements.filter((element) => element.id !== activeId),
    }));
    setActiveId(null);
  }

  function resetCanvas() {
    setCanvasId(null);
    setTitle(DEFAULT_PROJECT_TITLE);
    setDoc(emptyDocument);
    setActiveId(null);
    setMessage("");
    setProjectMenuOpen(false);
  }

  async function renderToDataUrl(maxSize = CANVAS_SIZE) {
    const scale = maxSize / CANVAS_SIZE;
    const canvas = document.createElement("canvas");
    canvas.width = maxSize;
    canvas.height = maxSize;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("无法创建画布");

    context.scale(scale, scale);
    context.fillStyle = doc.background;
    context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

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
          context.fillText(line, -element.width / 2, -element.height / 2 + index * element.fontSize * 1.25);
        });
      }

      context.restore();
    }

    return canvas.toDataURL("image/png");
  }

  async function handleExport() {
    try {
      const dataUrl = await renderToDataUrl();
      downloadDataUrl(dataUrl, `${title || "lumina-canvas"}-${Date.now()}.png`);
    } catch {
      setMessage("导出失败，请确认图片可正常加载");
    }
  }

  async function handleSave() {
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
      refreshCanvasList();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadCanvas(id: number) {
    try {
      const data = await getCanvas(id);
      setCanvasId(data.id);
      setTitle(data.title);
      setDoc(normalizeCanvasData(data.canvas_data));
      setActiveId(null);
      setMessage("画布已打开");
      setProjectMenuOpen(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "打开失败");
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-[#f7f7f8] text-[#1d1d1f]">
      <header className="absolute left-0 right-[360px] top-0 z-20 flex h-12 items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <button className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1d1d1f] text-white">
            <BrandLogo className="h-5 w-5" />
          </button>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            aria-label="项目名字"
            className="h-8 w-48 rounded-[9px] bg-transparent px-1 text-[15px] font-semibold outline-none hover:bg-white/70 focus:bg-white"
          />
          <button
            onClick={() => setProjectMenuOpen((open) => !open)}
            className="rounded-full p-1.5 text-[#8e8e93] hover:bg-white"
            title="项目菜单"
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          {projectMenuOpen && (
            <div className="absolute left-14 top-11 z-40 w-[300px] rounded-[18px] border border-black/10 bg-white p-2 shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
              <button
                onClick={resetCanvas}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                <Plus className="h-4 w-4" />
                新建项目
              </button>

              <div className="my-2 h-px bg-black/5" />
              <div className="px-3 pb-1 text-[12px] font-medium text-[#8e8e93]">已保存项目</div>
              <div className="max-h-56 overflow-y-auto">
                {canvasList.length === 0 ? (
                  <p className="px-3 py-3 text-[13px] text-[#b3b3b8]">暂无保存项目</p>
                ) : (
                  canvasList.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLoadCanvas(item.id)}
                      className={`flex w-full items-center justify-between rounded-[12px] px-3 py-2.5 text-left hover:bg-[#f5f5f7] ${
                        canvasId === item.id ? "text-[#007AFF]" : "text-[#1d1d1f]"
                      }`}
                    >
                      <span className="truncate text-[14px]">{item.title || DEFAULT_PROJECT_TITLE}</span>
                      <span className="ml-3 text-[12px] text-[#b3b3b8]">v{item.version}</span>
                    </button>
                  ))
                )}
              </div>

              <div className="my-2 h-px bg-black/5" />
              <button
                onClick={refreshCanvasList}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] text-[#1d1d1f] hover:bg-[#f5f5f7]"
              >
                <RotateCcw className="h-4 w-4" />
                刷新项目
              </button>
              <button
                onClick={() => router.push("/studio")}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left text-[14px] text-[#d70015] hover:bg-[#fff1f2]"
              >
                <LogOut className="h-4 w-4" />
                退出画布
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 text-[12px] text-[#8e8e93]">
          <span>0</span>
          <button
            onClick={() => router.push("/settings")}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[#007AFF] text-white"
            title="账号设置"
          >
            <Bot className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="grid h-full grid-cols-[1fr_360px]">
        <section className="relative min-w-0 bg-[#f4f4f5]">
          <div
            ref={stageWrapRef}
            className="absolute inset-0 flex items-center justify-center"
            onPointerDown={() => setActiveId(null)}
          >
            {doc.elements.length === 0 ? (
              <p className="select-none text-[15px] text-[#b3b3b8]">
                输入你的想法开始创作，或按 <span className="rounded bg-white px-2 py-1 text-[#8e8e93] shadow-sm">C</span> 开始对话
              </p>
            ) : null}

            <div
              className={`relative origin-center overflow-hidden transition-shadow ${
                doc.elements.length === 0 ? "opacity-0" : "rounded-[4px] bg-white shadow-[0_18px_70px_rgba(0,0,0,0.10)]"
              }`}
              style={{
                width: CANVAS_SIZE,
                height: CANVAS_SIZE,
                transform: `scale(${stageScale})`,
                background: doc.background,
              }}
            >
              {doc.elements.map((element) => (
                <div
                  key={element.id}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    setActiveId(element.id);
                    setDrag({
                      id: element.id,
                      startX: event.clientX,
                      startY: event.clientY,
                      originX: element.x,
                      originY: element.y,
                    });
                  }}
                  className="absolute cursor-move select-none"
                  style={{
                    left: element.x,
                    top: element.y,
                    width: element.width,
                    height: element.height,
                    transform: `rotate(${element.rotation}deg)`,
                    outline: activeId === element.id ? `${2 / stageScale}px solid #007AFF` : "none",
                    outlineOffset: 4 / stageScale,
                  }}
                >
                  {element.type === "image" ? (
                    <img src={element.src} alt="" draggable={false} className="h-full w-full object-cover" />
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
            </div>
          </div>

          <div className="absolute bottom-4 left-4 flex items-center gap-3 text-[#8e8e93]">
            <button className="h-7 w-7 rounded-full hover:bg-white" title="状态" />
            <Layers className="h-4 w-4" />
            <FolderOpen className="h-4 w-4" />
            <Grid3X3 className="h-4 w-4" />
            <span className="ml-2 text-[12px]">100%</span>
          </div>

          <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-[16px] border border-black/10 bg-white/95 p-1.5 shadow-[0_10px_35px_rgba(0,0,0,0.14)] backdrop-blur">
            <ToolbarButton active icon={<MousePointer2 className="h-4 w-4" />} label="选择" />
            <ToolbarButton icon={<Target className="h-4 w-4" />} label="定位" />
            <ToolbarButton icon={<ImagePlus className="h-4 w-4" />} label="图片" onClick={() => fileInputRef.current?.click()} />
            <ToolbarButton icon={<Grid3X3 className="h-4 w-4" />} label="网格" />
            <ToolbarButton icon={<Square className="h-4 w-4" />} label="形状" />
            <ToolbarButton icon={<PenLine className="h-4 w-4" />} label="画笔" />
            <ToolbarButton icon={<Type className="h-4 w-4" />} label="文字" onClick={() => addText()} />
            <ToolbarButton icon={<Maximize2 className="h-4 w-4" />} label="适应" />
            <ToolbarButton icon={<Save className="h-4 w-4" />} label={saving ? "保存中" : "保存"} onClick={handleSave} />
            <ToolbarButton icon={<Download className="h-4 w-4" />} label="导出" onClick={handleExport} />
          </div>

          {settingsOpen && (
            <div className="absolute bottom-20 right-6 z-20 w-[310px] rounded-[18px] border border-black/10 bg-white p-4 shadow-[0_18px_55px_rgba(0,0,0,0.16)]">
              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-[#3a3a3c]">质量</p>
                <div className="grid grid-cols-4 rounded-[14px] bg-[#f5f5f7] p-1 text-[12px]">
                  {["自动", "高", "中", "低"].map((item) => (
                    <button
                      key={item}
                      onClick={() => setQuality(item)}
                      className={`h-8 rounded-[11px] ${quality === item ? "bg-white shadow-sm" : "text-[#8e8e93]"}`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-[#3a3a3c]">尺寸</p>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="rounded-[9px] bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#3a3a3c]">W 2048</div>
                  <span className="text-[#c7c7cc]">↔</span>
                  <div className="rounded-[9px] bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#3a3a3c]">H 2048</div>
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-[13px] font-medium text-[#3a3a3c]">Size</p>
                <div className="grid grid-cols-3 gap-2">
                  {ratioOptions.map((item) => (
                    <button
                      key={item}
                      onClick={() => setRatio(item)}
                      className={`flex h-14 flex-col items-center justify-center rounded-[10px] border text-[12px] ${
                        ratio === item ? "border-[#d1d1d6] bg-[#f2f2f3]" : "border-[#e5e5ea] bg-white"
                      }`}
                    >
                      <Square className="mb-1 h-4 w-4" />
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[13px] font-medium text-[#3a3a3c]">Image</p>
                <div className="grid grid-cols-4 gap-2">
                  {imageCountOptions.map((count) => (
                    <button
                      key={count}
                      onClick={() => setImageCount(count)}
                      className={`h-8 rounded-[9px] border text-[12px] ${
                        imageCount === count ? "border-[#d1d1d6] bg-[#f2f2f3]" : "border-[#e5e5ea] bg-white"
                      }`}
                    >
                      {count} img
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
            onChange={handleImageUpload}
            className="hidden"
          />
        </section>

        <aside className="relative flex h-full flex-col border-l border-black/10 bg-white">
          <div className="flex h-12 items-center justify-between border-b border-black/5 px-4">
            <h1 className="text-[15px] font-semibold">新对话</h1>
            <div className="flex items-center gap-2 text-[#c7c7cc]">
              <Settings2 className="h-4 w-4" />
              <Share2 className="h-4 w-4" />
              <ArrowUp className="h-4 w-4" />
            </div>
          </div>

          <div className="flex flex-1 flex-col items-center justify-center px-6 pb-24 text-center">
            <div className="mb-8 flex flex-col items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#ff6aa2]/15 text-[#ff5f9b]">
                <Wand2 className="h-5 w-5" />
              </div>
              <p className="text-[14px] font-semibold text-[#1d1d1f]">试试这些 Drmine Skills</p>
            </div>

            <div className="flex max-w-[280px] flex-wrap justify-center gap-2">
              {skills.map((skill) => (
                <button
                  key={skill}
                  onClick={() => setPrompt(skill)}
                  className="rounded-full border border-black/10 bg-white px-3 py-2 text-[13px] text-[#3a3a3c] shadow-sm transition hover:border-[#007AFF]/30 hover:text-[#007AFF]"
                >
                  {skill}
                </button>
              ))}
            </div>

            <div className="mt-8 w-full rounded-[14px] border border-black/5 bg-[#fafafa] p-3 text-left">
              <div className="mb-2 flex items-center justify-between text-[13px] text-[#8e8e93]">
                <span>已保存画布</span>
                <button onClick={refreshCanvasList} className="hover:text-[#007AFF]">刷新</button>
              </div>
              <div className="max-h-32 space-y-1 overflow-y-auto">
                {canvasList.length === 0 ? (
                  <p className="py-4 text-center text-[13px] text-[#b3b3b8]">暂无保存记录</p>
                ) : (
                  canvasList.slice(0, 4).map((item) => (
                    <button
                      key={item.id}
                      onClick={() => handleLoadCanvas(item.id)}
                      className="flex w-full items-center justify-between rounded-[9px] px-2 py-2 text-left hover:bg-white"
                    >
                      <span className="truncate text-[13px] text-[#3a3a3c]">{item.title}</span>
                      <span className="text-[12px] text-[#b3b3b8]">v{item.version}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 border-t border-black/5 bg-white p-4">
            {activeElement && (
              <ActiveInspector
                element={activeElement}
                updateElement={updateElement}
                removeActiveElement={removeActiveElement}
              />
            )}

            {message && <p className="mb-2 text-[12px] text-[#8e8e93]">{message}</p>}
            <div className="rounded-[18px] border border-black/10 bg-white p-2 shadow-[0_8px_30px_rgba(0,0,0,0.08)]">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="输入你的想法..."
                rows={3}
                className="w-full resize-none rounded-[12px] px-3 py-2 text-[14px] outline-none"
              />
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setSettingsOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-full bg-[#f5f5f7] px-3 py-2 text-[13px] text-[#3a3a3c]"
                >
                  <ImagePlus className="h-4 w-4" /> 图像
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-2">
                  <button className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f5f5f7]">
                    <Mic className="h-4 w-4 text-[#8e8e93]" />
                  </button>
                  <button
                    onClick={handlePromptSend}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1d1d1f] text-white"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
}

function ToolbarButton({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-[10px] transition ${
        active ? "bg-[#1d1d1f] text-white" : "text-[#5c5c60] hover:bg-[#f5f5f7]"
      }`}
    >
      {icon}
    </button>
  );
}

function ActiveInspector({
  element,
  updateElement,
  removeActiveElement,
}: {
  element: CanvasElement;
  updateElement: (id: string, patch: Partial<CanvasElement>) => void;
  removeActiveElement: () => void;
}) {
  return (
    <div className="mb-3 rounded-[14px] border border-black/5 bg-[#fafafa] p-3 text-left">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] font-semibold text-[#1d1d1f]">选中图层</span>
        <button onClick={removeActiveElement} className="rounded-full p-1 text-[#8e8e93] hover:bg-white">
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {element.type === "text" && (
        <textarea
          value={element.content}
          onChange={(event) => updateElement(element.id, { content: event.target.value })}
          className="mb-2 min-h-[64px] w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[13px] outline-none"
        />
      )}

      <div className="grid grid-cols-4 gap-2">
        <MiniNumber label="X" value={element.x} onChange={(value) => updateElement(element.id, { x: value })} />
        <MiniNumber label="Y" value={element.y} onChange={(value) => updateElement(element.id, { y: value })} />
        <MiniNumber label="W" value={element.width} onChange={(value) => updateElement(element.id, { width: value })} />
        <MiniNumber label="H" value={element.height} onChange={(value) => updateElement(element.id, { height: value })} />
      </div>
    </div>
  );
}

function MiniNumber({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="text-[11px] text-[#8e8e93]">
      {label}
      <input
        type="number"
        value={Math.round(value)}
        onChange={(event) => onChange(Number(event.target.value) || 0)}
        className="mt-1 h-8 w-full rounded-[8px] border border-black/10 bg-white px-2 text-[12px] text-[#1d1d1f] outline-none"
      />
    </label>
  );
}
