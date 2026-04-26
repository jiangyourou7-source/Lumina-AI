"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Play,
  Download,
  Maximize2,
  Upload,
  Info,
  Loader2,
  X,
  ChevronDown,
} from "lucide-react";
import { editImage, generateImage, isAuthenticated } from "@/lib/openai-proxy";

type StudioState = "idle" | "generating" | "success" | "error";

const GALLERY_KEY = "lumina-gallery";
const STORAGE_KEY = "lumina-studio-draft";

const resolutions = [
  { label: "1k", value: "1k" },
  { label: "2k", value: "2k" },
  { label: "4k", value: "4k" },
];

const aspectRatios = [
  { label: "1:1", value: "1:1" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
  { label: "4:3", value: "4:3" },
  { label: "3:4", value: "3:4" },
];

const sizeByAspectRatio: Record<string, string> = {
  "1:1": "1:1",
  "16:9": "16:9",
  "9:16": "9:16",
  "4:3": "4:3",
  "3:4": "3:4",
};

const legacyResolutionValues = new Set(["1024x1024", "1536x1024", "1024x1536"]);
const supported4kRatios = new Set(["16:9", "9:16", "2:1", "1:2", "21:9", "9:21"]);

interface FormState {
  model: string;
  prompt: string;
  resolution: string;
  aspectRatio: string;
  imageCount: number;
  officialFallback: boolean;
  referenceImage: string | null;
  referenceFileName: string | null;
}

const defaultForm: FormState = {
  model: "gpt-image-2",
  prompt: "",
  resolution: "1k",
  aspectRatio: "1:1",
  imageCount: 1,
  officialFallback: false,
  referenceImage: null,
  referenceFileName: null,
};

function saveToGallery(item: any) {
  try {
    const gallery = JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]");
    gallery.unshift(item);
    localStorage.setItem(GALLERY_KEY, JSON.stringify(gallery));
  } catch {}
}

export default function StudioPage() {
  const router = useRouter();
  const [state, setState] = useState<StudioState>("idle");
  const [form, setForm] = useState<FormState>(defaultForm);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [generatedUrls, setGeneratedUrls] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [cost] = useState("0.006");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/studio");
    }
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.model === "gpt-image-1.5") {
          parsed.model = defaultForm.model;
        }
        if (legacyResolutionValues.has(parsed.resolution)) {
          parsed.resolution = defaultForm.resolution;
        }
        setForm({ ...defaultForm, ...parsed });
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(form));
  }, [form]);

  const updateForm = useCallback(
    <K extends keyof FormState>(key: K, value: FormState[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("参考图不能超过 10MB");
      setState("error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      updateForm("referenceImage", ev.target?.result as string);
      updateForm("referenceFileName", file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleGenerate = async () => {
    if (!form.prompt.trim()) return;

    setState("generating");
    setErrorMsg("");

    try {
      const count = Math.max(1, Math.min(4, form.imageCount));
      const size = sizeByAspectRatio[form.aspectRatio] || form.resolution;
      if (form.resolution === "4k" && !supported4kRatios.has(size)) {
        setErrorMsg("4K 仅支持 16:9、9:16、2:1、1:2、21:9、9:21 比例；当前比例建议使用 2K。");
        setState("error");
        return;
      }
      const prompt = form.officialFallback
        ? `${form.prompt}\n\n商业精修质感，适合企业宣传、电商主图和朋友圈发布。`
        : form.prompt;
      const urls: string[] = [];

      for (let i = 0; i < count; i += 1) {
        const result = form.referenceImage
          ? await editImage({
              imageUrl: form.referenceImage,
              prompt,
              size,
              resolution: form.resolution,
              quality: "high",
              model: form.model,
            })
          : await generateImage({
              prompt,
              size,
              resolution: form.resolution,
              quality: "high",
              model: form.model,
            });

        urls.push(result.url);
      }

      setGeneratedUrls(urls);
      setGeneratedUrl(urls[0]);
      setState("success");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "AI 暂时忙碌，请稍后重试");
      setState("error");
    }
  };

  const handleDownload = async (urlToDownload = generatedUrl) => {
    if (!urlToDownload) return;
    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `lumina-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      window.open(urlToDownload, "_blank");
    }
  };

  const handleSave = () => {
    if (!generatedUrl) return;
    generatedUrls.forEach((url, index) => {
      saveToGallery({
        id: `${Date.now()}-${index}`,
        url,
        title: form.prompt.slice(0, 30) || "未命名作品",
        prompt: form.prompt,
        createdAt: new Date().toISOString(),
        category: "其他",
      });
    });
  };

  return (
    <div className="h-[calc(100vh-64px)] flex bg-[#F8FAFC]">
      <div className="w-[440px] min-w-[440px] border-r border-[#E2E8F0] bg-white flex flex-col h-full">
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <FormField label="模型">
            <input
              type="text"
              value={form.model}
              onChange={(e) => updateForm("model", e.target.value)}
              className="form-input"
            />
          </FormField>

          <FormField label="提示词">
            <textarea
              value={form.prompt}
              onChange={(e) => updateForm("prompt", e.target.value)}
              placeholder="cute things."
              className="form-input min-h-[120px] resize-y"
              rows={5}
            />
          </FormField>

          <div className="flex gap-3">
            <div className="flex-1">
              <FormField label="分辨率" info="输出图像分辨率">
                <div className="relative">
                  <select
                    value={form.resolution}
                    onChange={(e) => updateForm("resolution", e.target.value)}
                    className="form-input appearance-none pr-8"
                  >
                    {resolutions.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
                </div>
              </FormField>
            </div>
            <div className="flex-1">
              <FormField label="宽高比">
                <div className="relative">
                  <select
                    value={form.aspectRatio}
                    onChange={(e) => updateForm("aspectRatio", e.target.value)}
                    className="form-input appearance-none pr-8"
                  >
                    {aspectRatios.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#94A3B8] pointer-events-none" />
                </div>
              </FormField>
            </div>
          </div>

          <FormField label="图像数量">
            <input
              type="number"
              min={1}
              max={4}
              value={form.imageCount}
              onChange={(e) =>
                updateForm("imageCount", Math.max(1, Math.min(4, parseInt(e.target.value) || 1)))
              }
              className="form-input"
            />
          </FormField>

          <FormField label="官方渠道兜底">
            <div className="flex items-center gap-3">
              <button
                onClick={() => updateForm("officialFallback", !form.officialFallback)}
                className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                  form.officialFallback ? "bg-[#2563EB]" : "bg-[#CBD5E1]"
                }`}
              >
                <div
                  className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                    form.officialFallback ? "translate-x-[22px]" : "translate-x-0.5"
                  }`}
                />
              </button>
              <span className="text-[13px] text-[#64748B]">
                {form.officialFallback ? "已开启" : "已关闭"}
              </span>
            </div>
          </FormField>

          <FormField label="参考图像">
            <div>
              {form.referenceImage ? (
                <div className="relative rounded-[10px] overflow-hidden border border-[#E2E8F0]">
                  <img
                    src={form.referenceImage}
                    alt="参考图"
                    className="w-full h-32 object-cover"
                  />
                  <button
                    onClick={() => {
                      updateForm("referenceImage", null);
                      updateForm("referenceFileName", null);
                    }}
                    className="absolute top-2 right-2 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center"
                  >
                    <X className="w-3 h-3 text-white" />
                  </button>
                  {form.referenceFileName && (
                    <p className="text-[12px] text-[#64748B] px-3 py-2 truncate">
                      {form.referenceFileName}
                    </p>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-6 border-2 border-dashed border-[#CBD5E1] rounded-[10px] hover:border-[#2563EB] hover:bg-[#EFF6FF]/50 transition-all duration-200 flex flex-col items-center justify-center gap-2"
                >
                  <Upload className="w-6 h-6 text-[#94A3B8]" />
                  <span className="text-[13px] text-[#64748B]">Click to upload image</span>
                  <span className="text-[11px] text-[#94A3B8]">PNG, JPG, WEBP · Max 10MB · 1 file</span>
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </FormField>
        </div>

        <div className="p-5 border-t border-[#E2E8F0] bg-white">
          <button
            onClick={handleGenerate}
            disabled={!form.prompt.trim() || state === "generating"}
            className="w-full h-12 bg-[#2563EB] text-white rounded-[10px] text-[15px] font-medium flex items-center justify-center gap-2 hover:bg-[#1D4ED8] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            {state === "generating" ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                生成中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run
              </>
            )}
          </button>
          <p className="text-[12px] text-[#94A3B8] text-center mt-2">
            预计消耗 ≈ ${cost}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[#F8FAFC]">
        <div className="flex-1 overflow-y-auto p-8 flex items-center justify-center">
          {state === "idle" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                <Play className="w-8 h-8 text-[#2563EB]" />
              </div>
              <p className="text-[17px] text-[#64748B] font-medium">
                输入提示词后点击 Run 生成
              </p>
              <p className="text-[13px] text-[#94A3B8] mt-1">
                支持中文和英文描述
              </p>
            </div>
          )}

          {state === "generating" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 relative">
                <div className="absolute inset-0 rounded-full border-4 border-[#EFF6FF]"></div>
                <div className="absolute inset-0 rounded-full border-4 border-[#2563EB] border-t-transparent animate-spin"></div>
              </div>
              <p className="text-[17px] text-[#0F172A] font-medium mb-1">AI 正在创作中</p>
              <p className="text-[13px] text-[#94A3B8]">通常需要 3-10 秒</p>
            </div>
          )}

          {state === "success" && generatedUrl && (
            <div className="w-full max-w-2xl animate-fade-in-up">
              <div className="relative rounded-[16px] overflow-hidden shadow-card bg-white p-3">
                <img
                  src={generatedUrl}
                  alt="生成结果"
                  className="w-full rounded-[12px]"
                />
                <div className="absolute bottom-5 right-5 flex gap-2">
                  <button
                    onClick={() => handleDownload()}
                    className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-white transition-colors"
                    title="下载"
                  >
                    <Download className="w-4 h-4 text-[#0F172A]" />
                  </button>
                  <button
                    onClick={() => {
                      handleSave();
                      window.open(generatedUrl, "_blank");
                    }}
                    className="w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full shadow-md flex items-center justify-center hover:bg-white transition-colors"
                    title="全屏查看"
                  >
                    <Maximize2 className="w-4 h-4 text-[#0F172A]" />
                  </button>
                </div>
              </div>
              <p className="text-[12px] text-[#94A3B8] text-center mt-3">
                Image link valid for 24 hours
              </p>
              {generatedUrls.length > 1 && (
                <div className="mt-4 grid grid-cols-4 gap-3">
                  {generatedUrls.map((url) => (
                    <button
                      key={url}
                      onClick={() => setGeneratedUrl(url)}
                      className={`aspect-square overflow-hidden rounded-[10px] border bg-white ${
                        generatedUrl === url ? "border-[#007AFF]" : "border-[#E2E8F0]"
                      }`}
                    >
                      <img src={url} alt="生成缩略图" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {state === "error" && (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
                <X className="w-8 h-8 text-red-500" />
              </div>
              <p className="text-[17px] text-red-500 font-medium mb-2">
                {errorMsg || "AI 暂时忙碌，请稍后重试"}
              </p>
              <button
                onClick={handleGenerate}
                className="px-6 py-2.5 bg-[#2563EB] text-white rounded-[10px] text-[15px] font-medium hover:bg-[#1D4ED8] active:scale-[0.98] transition-all duration-200"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function FormField({
  label,
  info,
  children,
}: {
  label: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-1.5">
        <label className="text-[13px] font-medium text-[#0F172A]">{label}</label>
        {info && (
          <span className="group relative">
            <Info className="w-3.5 h-3.5 text-[#94A3B8] cursor-help" />
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-[#0F172A] text-white text-[11px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              {info}
            </span>
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
