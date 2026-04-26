"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Image,
  Layers3,
  PenTool,
  Search,
  Sparkles,
  Wand2,
} from "lucide-react";
import { isAuthenticated } from "@/lib/openai-proxy";

const projectTypes = ["电商主图", "朋友圈九宫格", "餐饮海报", "品牌物料"];

const taskSteps = [
  "正在分析品牌语气",
  "正在规划版式系统",
  "正在生成精修视觉",
];

const outputCards = [
  { title: "主视觉", className: "bg-[#E5F2FF]" },
  { title: "菜单卡", className: "bg-[#FFF4DE]" },
  { title: "优惠图", className: "bg-[#F5F5F7]" },
  { title: "门店图", className: "bg-[#EAF8EE]" },
  { title: "朋友圈封面", className: "bg-[#F2EDFF]" },
  { title: "品牌故事", className: "bg-[#F8EDEE]" },
];

const featureBlocks = [
  {
    icon: <Sparkles className="h-5 w-5" />,
    eyebrow: "系统化出图",
    title: "从一张图，到一套品牌视觉",
    desc: "同一品牌调性下生成主图、活动图和社交媒体素材，让中小企业也能拥有稳定的视觉系统。",
  },
  {
    icon: <PenTool className="h-5 w-5" />,
    eyebrow: "画布编辑",
    title: "生成之后，继续精修",
    desc: "上传图片、添加文字、调整图层并导出 PNG，适合朋友圈精修和商业海报的最后一公里。",
  },
  {
    icon: <Layers3 className="h-5 w-5" />,
    eyebrow: "作品沉淀",
    title: "每次创作都能回到作品库",
    desc: "生成图和画布保存到账号下，方便复用、整理和继续编辑。",
  },
];

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    setAuthed(isAuthenticated());
  }, []);

  const studioHref = useMemo(() => (authed ? "/studio" : "/login?next=/studio"), [authed]);
  const editorHref = useMemo(() => (authed ? "/editor" : "/login?next=/editor"), [authed]);

  return (
    <div className="bg-[#F5F5F7] text-[#1D1D1F]">
      <section className="mx-auto max-w-desktop px-6 pb-16 pt-12 lg:pb-24 lg:pt-16">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-[14px] font-medium text-[#1D1D1F] shadow-sm">
              <Sparkles className="h-4 w-4 text-[#007AFF]" />
              你的 AI 设计助手
            </div>

            <h1 className="max-w-4xl text-[44px] font-semibold leading-[1.08] tracking-normal text-[#1D1D1F] sm:text-[64px]">
              为
              <span className="mx-2 inline-flex rounded-[18px] border border-black/10 bg-white px-4 py-1 align-middle text-[#007AFF] shadow-sm">
                中小企业
              </span>
              设计一套
              <span className="mx-2 inline-flex rounded-[18px] border border-black/10 bg-white px-4 py-1 align-middle text-[#1D1D1F] shadow-sm">
                朋友圈精修海报
              </span>
            </h1>

            <p className="mt-8 max-w-2xl text-[19px] leading-8 text-[#86868B]">
              Lumina AI 把生成、画布编辑和作品沉淀放在一个工作流里，帮企业主和精修朋友圈用户快速做出有质感的商业视觉。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={studioHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] bg-[#007AFF] px-6 text-[15px] font-semibold text-white no-underline transition hover:bg-[#0067D8] active:scale-[0.98]"
              >
                立即设计 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={editorHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[12px] border border-[#D1D1D6] bg-white px-6 text-[15px] font-semibold text-[#1D1D1F] no-underline transition hover:bg-[#F9F9FB] active:scale-[0.98]"
              >
                打开画布
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {projectTypes.map((type) => (
                <Link
                  key={type}
                  href={studioHref}
                  className="rounded-full border border-black/5 bg-white px-4 py-2 text-[14px] font-medium text-[#1D1D1F] no-underline shadow-sm transition hover:border-[#007AFF]/30 hover:text-[#007AFF]"
                >
                  {type}
                </Link>
              ))}
            </div>
          </div>

          <ProductPreview />
        </div>
      </section>

      <section className="mx-auto max-w-desktop px-6 pb-20">
        <div className="mb-8 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-[14px] font-semibold text-[#007AFF]">功能特性</p>
            <h2 className="mt-2 text-[34px] font-semibold leading-tight text-[#1D1D1F] sm:text-[44px]">
              设计，不止于生成
            </h2>
          </div>
          <p className="max-w-xl text-[17px] leading-7 text-[#86868B]">
            AI 只是起点，真正可交付的商业图还需要一致性、可编辑性和可复用资产。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {featureBlocks.map((feature) => (
            <div key={feature.title} className="rounded-[20px] border border-black/5 bg-white p-6 shadow-card">
              <div className="mb-8 inline-flex h-10 w-10 items-center justify-center rounded-[12px] bg-[#F5F5F7] text-[#007AFF]">
                {feature.icon}
              </div>
              <p className="mb-2 text-[13px] font-semibold text-[#007AFF]">{feature.eyebrow}</p>
              <h3 className="mb-3 text-[22px] font-semibold leading-tight text-[#1D1D1F]">{feature.title}</h3>
              <p className="text-[15px] leading-7 text-[#86868B]">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductPreview() {
  return (
    <div className="rounded-[28px] border border-black/5 bg-white p-3 shadow-card-hover">
      <div className="rounded-[24px] bg-[#111113] p-4 text-white">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
            <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
            <div className="h-3 w-3 rounded-full bg-[#28C840]" />
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/70">Lumina Workspace</span>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[13px] text-white/55">新对话</p>
              <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#1D1D1F]">Auto</span>
            </div>

            <div className="rounded-[16px] bg-white p-4 text-[#1D1D1F]">
              <p className="text-[15px] leading-7">
                为跑鞋品牌设计详情页视觉素材，包括主图、材质特写和社交媒体发布图。
              </p>
            </div>

            <div className="mt-4 space-y-3">
              {taskSteps.map((step) => (
                <div key={step} className="flex items-center justify-between rounded-[14px] bg-white/[0.07] px-3 py-3">
                  <span className="text-[13px] text-white/75">{step}</span>
                  <span className="inline-flex items-center gap-1 text-[12px] text-[#30D158]">
                    <CheckCircle2 className="h-3.5 w-3.5" /> 已完成
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[16px] bg-white/[0.07] p-3">
              <div className="mb-2 flex items-center gap-2 text-[13px] text-white/65">
                <Search className="h-4 w-4" />
                参考趋势
              </div>
              <div className="flex flex-wrap gap-2">
                {["高端产品摄影", "统一光线", "可控文字区"].map((tag) => (
                  <span key={tag} className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/75">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-[20px] border border-white/10 bg-white/[0.06] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/55">生成结果</p>
                <h2 className="text-[20px] font-semibold">运动产品发布</h2>
              </div>
              <Image className="h-5 w-5 text-white/50" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {outputCards.map((card) => (
                <div key={card.title} className="overflow-hidden rounded-[14px] bg-white p-2">
                  <div className={`aspect-[4/5] rounded-[10px] ${card.className}`} />
                  <p className="mt-2 truncate text-[12px] font-medium text-[#1D1D1F]">{card.title}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-[16px] bg-white p-4 text-[#1D1D1F]">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-semibold">画布图层</span>
                <Wand2 className="h-4 w-4 text-[#007AFF]" />
              </div>
              <div className="space-y-2">
                {["产品主视觉", "性能标题", "行动按钮"].map((layer) => (
                  <div key={layer} className="rounded-[10px] bg-[#F5F5F7] px-3 py-2 text-[13px] text-[#1D1D1F]">
                    {layer}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
