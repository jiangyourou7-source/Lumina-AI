"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Download,
  Maximize2,
  Upload,
  Info,
  X,
  ChevronDown,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import {
  createOrder,
  editImage,
  generateImage,
  getSession,
  getUserProfile,
  getUserQuota,
  markPromoPopupShown,
} from "@/lib/openai-proxy";

type StudioState = "idle" | "generating" | "success" | "error";

const GALLERY_KEY = "lumina-gallery";
const STORAGE_KEY = "lumina-studio-draft";
const MODEL_API_VALUE = "gpt-image-2";
const MODEL_DISPLAY_NAME = "GPT Image 2";
const MAX_PROMPT_LENGTH = 3000;

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

const promptGroups = [
  [
    {
      label: "电商主图",
      prompt: "生成一张高端电商产品主图，干净浅色背景，突出产品材质、细节和核心卖点，商业摄影质感。",
    },
    {
      label: "餐饮海报",
      prompt: "生成一张餐饮促销海报，食物新鲜诱人，暖色灯光，标题醒目，适合门店和社媒发布。",
    },
    {
      label: "门店活动",
      prompt: "生成一张门店活动宣传图，真实门店场景，优惠信息清晰，氛围热闹但画面保持高级干净。",
    },
    {
      label: "小红书封面",
      prompt: "生成一张小红书风格封面，构图清爽，标题区域明确，视觉吸引力强，适合种草内容。",
    },
    {
      label: "产品卖点",
      prompt: "生成一张产品卖点图，突出三到五个核心功能，信息层级清晰，适合电商详情页和广告投放。",
    },
    {
      label: "品牌质感",
      prompt: "生成一张品牌质感视觉图，简洁高级，统一色调，突出品牌调性和专业可信感。",
    },
  ],
  [
    {
      label: "新品上市",
      prompt: "生成一张新品上市宣传图，突出新品亮点，画面高级明亮，适合首发推广。",
    },
    {
      label: "节日促销",
      prompt: "生成一张节日促销视觉图，节日氛围自然，价格和活动信息清晰，适合社交媒体传播。",
    },
    {
      label: "朋友圈图",
      prompt: "生成一张适合朋友圈发布的宣传图，真实自然，有生活感，文字空间清晰。",
    },
    {
      label: "直播预告",
      prompt: "生成一张直播预告图，主播与产品氛围突出，时间信息清晰，视觉有点击欲。",
    },
    {
      label: "活动海报",
      prompt: "生成一张活动海报，主题明确，层级清晰，适合线上线下同步宣传。",
    },
    {
      label: "详情页图",
      prompt: "生成一张电商详情页视觉图，突出使用场景、产品细节和卖点说明，画面专业可信。",
    },
  ],
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
  referenceImage: string | null;
  referenceFileName: string | null;
}

const defaultForm: FormState = {
  model: MODEL_API_VALUE,
  prompt: "",
  resolution: "1k",
  aspectRatio: "1:1",
  imageCount: 1,
  referenceImage: null,
  referenceFileName: null,
};

type ProfileQuotaResponse = {
  quota: { total: number; used: number; remaining: number };
};

type LocalGalleryItem = {
  id: string;
  url: string;
  title: string;
  prompt: string;
  createdAt: string;
  category: string;
};

function saveToGallery(item: LocalGalleryItem) {
  try {
    const gallery = JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]") as LocalGalleryItem[];
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
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [promoLoading, setPromoLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [quota, setQuota] = useState<{ total: number; used: number; remaining: number } | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [mobilePanelOpen, setMobilePanelOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    void getSession()
      .then((session) => {
        if (!mounted) return;
        if (!session) {
          router.replace("/login?next=/studio");
          return;
        }
        setAuthReady(true);
        void getUserProfile()
          .then((profile) => {
            const userProfile = profile as ProfileQuotaResponse;
            if (mounted) setQuota(userProfile.quota);
          })
          .catch(() => undefined);
      })
      .catch(() => {
        if (mounted) router.replace("/login?next=/studio");
      });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.model === "gpt-image-1.5" || parsed.model === MODEL_DISPLAY_NAME) {
          parsed.model = defaultForm.model;
        }
        delete parsed.officialFallback;
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

  const activePromptGroup = promptGroups[0];

  const handleGenerate = async () => {
    if (!form.prompt.trim()) return;

    setState("generating");
    setErrorMsg("");

    try {
      const count = Math.max(1, Math.min(4, form.imageCount));
      if (quota && quota.remaining < count) {
        setErrorMsg("当前剩余生图额度不足，请升级套餐后继续生成。");
        setState("error");
        return;
      }
      const size = sizeByAspectRatio[form.aspectRatio] || form.resolution;
      if (form.resolution === "4k" && !supported4kRatios.has(size)) {
        setErrorMsg("4K 仅支持 16:9、9:16、2:1、1:2、21:9、9:21 比例；当前比例建议使用 2K。");
        setState("error");
        return;
      }
      const prompt = form.prompt;
      const requestModel = form.model === MODEL_DISPLAY_NAME ? MODEL_API_VALUE : form.model || MODEL_API_VALUE;
      const urls: string[] = [];
      let shouldShowPromo = false;

      for (let i = 0; i < count; i += 1) {
        const result = form.referenceImage
          ? await editImage({
              imageUrl: form.referenceImage,
              prompt,
              size,
              resolution: form.resolution,
              quality: "high",
              model: requestModel,
            })
          : await generateImage({
              prompt,
              size,
              resolution: form.resolution,
              quality: "high",
              model: requestModel,
            });

        urls.push(result.url);
        shouldShowPromo = shouldShowPromo || !!result.shouldShowPromoPopup;
        setQuota((current) =>
          current ? { ...current, remaining: result.remaining_quota, used: current.total - result.remaining_quota } : current
        );
      }

      setGeneratedUrls(urls);
      setGeneratedUrl(urls[0]);
      setState("success");
      setMobilePanelOpen(false);
      if (shouldShowPromo) {
        setShowPromoModal(true);
        void markPromoPopupShown();
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "AI 暂时忙碌，请稍后重试");
      setState("error");
    }
  };

  const handlePromoUpgrade = async () => {
    setPromoLoading(true);
    try {
      await createOrder("vip2", "promo_vip2");
      const nextQuota = await getUserQuota();
      setQuota({
        total: nextQuota.imageQuotaTotal,
        used: nextQuota.imageQuotaUsed,
        remaining: nextQuota.imageQuotaRemaining,
      });
      setShowPromoModal(false);
      setErrorMsg("优惠订单已创建，请完成支付后等待系统自动开通。");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "升级失败，请稍后重试");
      setState("error");
    } finally {
      setPromoLoading(false);
    }
  };

  const handleDismissPromo = () => {
    setShowPromoModal(false);
    void markPromoPopupShown();
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

  return authReady ? (
    <div className="relative h-[calc(100vh-64px)] flex bg-[#F8FAFC]">
      {mobilePanelOpen && (
        <button
          type="button"
          aria-label="关闭生成设置"
          onClick={() => setMobilePanelOpen(false)}
          className="fixed inset-0 z-40 bg-[#0F172A]/35 backdrop-blur-[2px] lg:hidden"
        />
      )}
      {panelCollapsed && (
        <button
          type="button"
          onClick={() => setPanelCollapsed(false)}
          className="absolute left-5 top-5 z-20 hidden rounded-full border border-[#D8E9FF] bg-white px-4 py-2 text-[13px] font-semibold text-[#007AFF] shadow-sm transition hover:bg-[#EFF6FF] lg:inline-flex"
        >
          生成设置
        </button>
      )}
      <button
        type="button"
        onClick={() => setMobilePanelOpen(true)}
        className="fixed bottom-6 left-1/2 z-30 inline-flex h-12 -translate-x-1/2 items-center justify-center rounded-full bg-[#2563EB] px-6 text-[15px] font-semibold text-white shadow-[0_14px_40px_rgba(37,99,235,0.28)] transition active:scale-[0.98] lg:hidden"
      >
        开始生成
      </button>
      <div
        className={`${
          mobilePanelOpen ? "fixed inset-x-0 bottom-0 z-50 max-h-[88vh] rounded-t-[24px] shadow-[0_-24px_80px_rgba(15,23,42,0.20)]" : "hidden"
        } ${
          panelCollapsed ? "lg:hidden" : "lg:static lg:z-auto lg:flex lg:h-full lg:max-h-none lg:w-[440px] lg:min-w-[440px] lg:rounded-none lg:shadow-none"
        } relative flex flex-col overflow-hidden border-r border-[#E2E8F0] bg-white`}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#E2E8F0] px-5 lg:hidden">
          <span className="text-[15px] font-semibold text-[#0F172A]">生成设置</span>
          <button
            type="button"
            onClick={() => setMobilePanelOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8FAFC] text-[#64748B]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          onClick={() => setPanelCollapsed(true)}
          className="absolute right-3 top-3 z-10 hidden rounded-full border border-[#E2E8F0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#64748B] transition hover:bg-[#F8FAFC] lg:inline-flex"
        >
          收起
        </button>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          <FormField label="模型">
            <input
              type="text"
              value={MODEL_DISPLAY_NAME}
              readOnly
              className="form-input bg-[#F8FAFC] text-[#0F172A]"
            />
          </FormField>

          <FormField label="提示词">
            <div className="relative">
              <textarea
                value={form.prompt}
                onChange={(e) => updateForm("prompt", e.target.value)}
                placeholder="描述你想要生成的内容......"
                maxLength={MAX_PROMPT_LENGTH}
                className="form-input min-h-[120px] resize-y pb-8"
                rows={5}
              />
              <span className="pointer-events-none absolute bottom-2 right-3 text-[11px] text-[#94A3B8]">
                {form.prompt.length}/{MAX_PROMPT_LENGTH}
              </span>
            </div>
          </FormField>

          <div>
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <h2 className="text-[13px] font-semibold text-[#0F172A]">常用提示词</h2>
                <span className="text-[12px] text-[#B4C0D0]">点击卡片可快速填入</span>
              </div>
            </div>
            <div className="rounded-[14px] border border-[#D8E9FF] bg-[#F5FAFF] p-4">
              <p className="mb-3 text-[12px] font-semibold text-[#64748B]">场景标签</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {activePromptGroup.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => updateForm("prompt", item.prompt)}
                    className="flex h-9 items-center justify-center rounded-[10px] border border-[#CFE4FF] bg-white px-2 text-center text-[12px] font-medium text-[#007AFF] transition hover:border-[#007AFF]/40 hover:bg-[#EFF6FF]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

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

          <FormField label="上传参考图（可选）">
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
                  className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-[10px] border-2 border-dashed border-[#CBD5E1] text-center transition-all duration-200 hover:border-[#2563EB] hover:bg-[#EFF6FF]/50"
                >
                  <Upload className="w-6 h-6 text-[#94A3B8]" />
                  <span className="text-[13px] text-[#64748B]">点击上传</span>
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
          <div className="mb-3 flex items-center justify-between rounded-[10px] bg-[#F8FAFC] px-3 py-2 text-[12px] text-[#64748B]">
            <span>剩余生成额度</span>
            <span className="font-semibold text-[#0F172A]">
              {quota ? `${quota.remaining}/${quota.total}` : "--"}
            </span>
          </div>
          {quota?.remaining === 0 && (
            <p className="mb-3 text-[12px] font-medium text-red-500">
              免费生图次数已用完，请升级 VIP 套餐继续生成。
            </p>
          )}
          <button
            onClick={handleGenerate}
            disabled={!form.prompt.trim() || state === "generating" || (!!quota && quota.remaining <= 0)}
            className="w-full h-12 bg-[#2563EB] text-white rounded-[10px] text-[15px] font-medium flex items-center justify-center gap-2 hover:bg-[#1D4ED8] active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
          >
            生成
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col h-full bg-[#F8FAFC]">
        <div className="relative flex flex-1 items-center justify-center overflow-hidden p-8">
          {state === "generating" && <GeneratingLightBackground />}

          {state === "idle" && (
            <div className="relative z-10 text-center">
              <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-[#EFF6FF] flex items-center justify-center">
                <BrandLogo className="h-11 w-11" />
              </div>
              <p className="text-[17px] text-[#0F172A] font-medium">
                生成
              </p>
              <p className="text-[13px] text-[#94A3B8] mt-1">
                描述你想要生成的内容后开始创作
              </p>
            </div>
          )}

          {state === "generating" && (
            <div className="relative z-10 text-center">
              <GeneratingCenterMark />
              <p className="mb-1 text-[17px] font-semibold text-[#0F172A]">AI 正在创作中</p>
              <p className="text-[13px] text-[#7B8EA8]">通常需要 3-10 秒</p>
            </div>
          )}

          {state === "success" && generatedUrl && (
            <div className="relative z-10 w-full max-w-2xl animate-fade-in-up">
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
                图片链接有效期为 24 小时
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
            <div className="relative z-10 text-center">
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
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0F172A]/35 px-4 backdrop-blur-sm">
          <div className="w-full max-w-[460px] rounded-[8px] bg-white p-6 shadow-[0_24px_80px_rgba(15,23,42,0.18)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-[#2563EB]">
                  VIP2 限时优惠
                </p>
                <h2 className="text-[24px] font-semibold text-[#0F172A]">你的免费生图快用完啦</h2>
              </div>
              <button
                type="button"
                onClick={handleDismissPromo}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F8FAFC] text-[#64748B] transition hover:bg-[#EEF2F7]"
                aria-label="关闭优惠弹窗"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mb-5 text-[15px] leading-7 text-[#475569]">
              你已经成功生成 3 张图片，当前免费额度仅剩 2 张。现在升级 VIP2，只需 19.9 元，即可获得
              100 张额度，并额外赠送 50 张，总共 150 张生图机会。
            </p>
            <div className="mb-5 grid grid-cols-3 gap-3">
              <PromoMetric label="原价格" value="¥19.9" />
              <PromoMetric label="原本额度" value="100 张" />
              <PromoMetric label="赠送后" value="150 张" />
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => void handlePromoUpgrade()}
                disabled={promoLoading}
                className="h-11 flex-1 rounded-[8px] bg-[#2563EB] px-4 text-[14px] font-semibold text-white transition hover:bg-[#1D4ED8] disabled:opacity-60"
              >
                {promoLoading ? "处理中..." : "19.9 元升级 VIP2，获得 150 张"}
              </button>
              <button
                type="button"
                onClick={handleDismissPromo}
                className="h-11 rounded-[8px] border border-[#E2E8F0] px-4 text-[14px] font-semibold text-[#475569] transition hover:bg-[#F8FAFC]"
              >
                暂不需要
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : (
    <div className="h-[calc(100vh-64px)] bg-[#F8FAFC]" />
  );
}

function PromoMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] bg-[#F8FAFC] p-3">
      <p className="mb-1 text-[12px] text-[#64748B]">{label}</p>
      <p className="text-[17px] font-semibold text-[#0F172A]">{value}</p>
    </div>
  );
}

function GeneratingLightBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden bg-[#F7FBFF]">
      <div className="absolute left-[12%] top-[16%] h-72 w-72 rounded-full bg-[#B9DDFF]/45 blur-3xl studio-aurora-drift" />
      <div className="absolute right-[10%] top-[20%] h-80 w-80 rounded-full bg-[#D8CAFF]/35 blur-3xl studio-aurora-drift studio-aurora-delay-1" />
      <div className="absolute bottom-[12%] left-[30%] h-96 w-96 rounded-full bg-[#C9F2FF]/40 blur-3xl studio-aurora-drift studio-aurora-delay-2" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08),rgba(248,250,252,0.72)_58%,rgba(248,250,252,0.96)_100%)]" />

      <div className="studio-particle left-[18%] top-[24%]" />
      <div className="studio-particle studio-particle-sm left-[31%] top-[62%] studio-particle-delay-1" />
      <div className="studio-particle studio-particle-lg left-[45%] top-[18%] studio-particle-delay-2" />
      <div className="studio-particle left-[62%] top-[70%] studio-particle-delay-3" />
      <div className="studio-particle studio-particle-sm left-[77%] top-[33%] studio-particle-delay-4" />
      <div className="studio-particle studio-particle-lg left-[84%] top-[58%] studio-particle-delay-5" />
      <div className="studio-particle studio-particle-sm left-[54%] top-[43%] studio-particle-delay-6" />
    </div>
  );
}

function GeneratingCenterMark() {
  return (
    <div className="relative mx-auto mb-5 flex h-32 w-32 items-center justify-center">
      <div className="absolute inset-0 rounded-[36px] bg-white/40 shadow-[0_24px_80px_rgba(59,130,246,0.18)] backdrop-blur-xl studio-center-pulse" />
      <div className="absolute inset-4 rounded-[28px] bg-[#EAF4FF]/80 blur-sm" />
      <div className="relative flex h-20 w-20 items-center justify-center rounded-[24px] bg-white/90 shadow-[0_14px_40px_rgba(15,23,42,0.08)]">
        <BrandLogo className="h-14 w-14 animate-pulse" />
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
