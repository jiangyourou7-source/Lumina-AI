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
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { getSession } from "@/lib/openai-proxy";

const heroChecklist = [
  "支持 1k / 2k / 4k 输出",
  "模板、工作台、作品库同一条链路",
  "生成之后还能继续精修和导出",
];

const statCards = [
  { value: "50+", label: "已整理模板基数" },
  { value: "3", label: "生成、精修、归档核心环节" },
  { value: "4K", label: "高分辨率输出支持" },
  { value: "1 条", label: "brief 即可启动完整工作流" },
];

const previewSteps = [
  "分析品牌语气与投放渠道",
  "规划版式与画面主次",
  "生成可交付的首版视觉",
];

const outputCards = [
  { title: "商品主图", tone: "from-[#E6F2FF] to-[#F7FBFF]" },
  { title: "活动海报", tone: "from-[#FFF3E1] to-[#FFF9F1]" },
  { title: "社媒封面", tone: "from-[#F4F3FF] to-[#FCFBFF]" },
  { title: "门店物料", tone: "from-[#EAF8EE] to-[#F7FCF8]" },
];

const featurePillars = [
  {
    eyebrow: "统一出图",
    title: "从一句业务 brief 扩展成一套商用物料",
    desc: "同一品牌语气下生成主图、海报、社媒封面和门店素材，减少在群聊里反复对齐方向。",
    icon: Sparkles,
  },
  {
    eyebrow: "继续精修",
    title: "不是出完图就结束，而是直接进入最后一公里",
    desc: "生成后继续在画布里补文案、换图、调层级，再导出最终成品，适合真实交付流程。",
    icon: PenTool,
  },
  {
    eyebrow: "资产沉淀",
    title: "把模板、作品和画布版本都留在账号里",
    desc: "作品库和画布存档已经打通，后续可以在同一项目风格上继续复用，而不是从零重来。",
    icon: Layers3,
  },
];

const useCases = [
  {
    title: "电商上新",
    desc: "适合主图、详情头图、促销 banner 和短视频封面。",
    deliverables: ["主图", "详情头图", "促销横幅"],
  },
  {
    title: "餐饮门店",
    desc: "适合开业海报、菜单卡、朋友圈九宫格和节日活动物料。",
    deliverables: ["开业海报", "菜单卡", "九宫格"],
  },
  {
    title: "品牌运营",
    desc: "适合会员日、联名活动、社媒封面和品牌故事页。",
    deliverables: ["活动 KV", "社媒封面", "品牌故事"],
  },
  {
    title: "企业宣传",
    desc: "适合招聘海报、企业文化页、发布会预告和内部宣传图。",
    deliverables: ["招聘海报", "文化页", "发布会预告"],
  },
];

export default function LandingPage() {
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getSession()
      .then((session) => {
        if (mounted) setAuthed(!!session);
      })
      .catch(() => {
        if (mounted) setAuthed(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const studioHref = useMemo(() => (authed ? "/studio" : "/login?next=/studio"), [authed]);
  return (
    <div className="relative overflow-hidden bg-[#F5F7FB] text-[#1D1D1F]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[520px] bg-[radial-gradient(circle_at_top_left,_rgba(0,122,255,0.16),_transparent_42%),radial-gradient(circle_at_85%_12%,_rgba(255,149,0,0.12),_transparent_28%)]" />

      <section className="relative mx-auto max-w-desktop px-6 pb-20 pt-12 lg:pb-28 lg:pt-20">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#007AFF]/10 bg-white/85 px-4 py-2 text-[14px] font-medium text-[#0F172A] shadow-sm backdrop-blur">
              <BrandLogo className="h-5 w-5" />
              AI 商业视觉工作台
            </div>

            <h1 className="mt-6 max-w-4xl text-[44px] font-semibold leading-[1.02] tracking-[-0.04em] text-[#0F172A] sm:text-[60px] lg:text-[76px]">
              把商用出图、
              <span className="block text-[#007AFF]">画布精修和资产归档</span>
              收进一条工作流
            </h1>

            <p className="mt-6 max-w-2xl text-[18px] leading-8 text-[#5B6474] sm:text-[19px]">
              {BRAND_NAME} 面向电商、餐饮、门店和品牌团队，把生成、继续编辑、保存复用串成同一套体验，
              让 AI 结果更接近真实交付物，而不是一次性的灵感图。
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={studioHref}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] bg-[#007AFF] px-6 text-[15px] font-semibold text-white no-underline transition hover:bg-[#0067D8] active:scale-[0.98]"
              >
                进入创作工作台 <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/templates"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-[14px] border border-[#D7DFEA] bg-white px-6 text-[15px] font-semibold text-[#0F172A] no-underline transition hover:bg-[#F8FAFD] active:scale-[0.98]"
              >
                查看模板库
              </Link>
            </div>

            <div className="mt-8 space-y-3">
              {heroChecklist.map((item) => (
                <div key={item} className="flex items-center gap-3 text-[15px] text-[#46505F]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[#E9F4FF] text-[#007AFF]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <HeroPreview />
        </div>
      </section>

      <section className="relative mx-auto max-w-desktop px-6 pb-8">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="rounded-[24px] border border-black/5 bg-white/85 p-5 shadow-card backdrop-blur"
            >
              <p className="text-[34px] font-semibold tracking-[-0.04em] text-[#0F172A]">{card.value}</p>
              <p className="mt-2 text-[14px] leading-6 text-[#667085]">{card.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-desktop px-6 py-20">
        <SectionHeader
          eyebrow="核心能力"
          title="不是只有一个 prompt 输入框，而是一套能继续推进的流程"
        />

        <div className="mt-10 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {featurePillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <article
                key={pillar.title}
                className="rounded-[28px] border border-black/5 bg-white p-7 shadow-card transition hover:-translate-y-1 hover:shadow-card-hover"
              >
                <div className="inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-[#F0F7FF] text-[#007AFF]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="mt-8 text-[13px] font-semibold uppercase tracking-[0.18em] text-[#007AFF]">
                  {pillar.eyebrow}
                </p>
                <h2 className="mt-3 text-[24px] font-semibold leading-tight text-[#0F172A]">
                  {pillar.title}
                </h2>
                <p className="mt-4 text-[15px] leading-7 text-[#667085]">{pillar.desc}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-desktop px-6 py-16">
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-4">
          {useCases.map((item) => (
            <article
              key={item.title}
              className="rounded-[26px] border border-black/5 bg-white p-6 shadow-card"
            >
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-[14px] bg-[#F5F7FB] text-[#007AFF]">
                <Image className="h-5 w-5" aria-hidden="true" />
              </div>
              <h3 className="mt-6 text-[22px] font-semibold text-[#0F172A]">{item.title}</h3>
              <p className="mt-3 text-[15px] leading-7 text-[#667085]">{item.desc}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {item.deliverables.map((deliverable) => (
                  <span
                    key={deliverable}
                    className="rounded-full border border-[#D7DFEA] bg-[#F8FAFD] px-3 py-1.5 text-[12px] font-medium text-[#475467]"
                  >
                    {deliverable}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

    </div>
  );
}

function HeroPreview() {
  return (
    <div className="relative">
      <div className="rounded-[32px] border border-black/5 bg-white/90 p-3 shadow-card-hover backdrop-blur">
        <div className="overflow-hidden rounded-[28px] bg-[#0F172A] p-4 text-white">
          <div className="mb-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[#FF5F57]" />
              <div className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
              <div className="h-3 w-3 rounded-full bg-[#28C840]" />
            </div>
            <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-[12px] text-white/70">
              Campaign / 春季上新
            </span>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[0.94fr_1.06fr]">
            <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[13px] text-white/58">任务输入</p>
                <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#0F172A]">
                  Auto Flow
                </span>
              </div>

              <div className="mt-4 rounded-[18px] bg-white p-4 text-[#0F172A]">
                <p className="text-[15px] leading-7">
                  为精品咖啡品牌做一套开业活动视觉，包含海报、社媒封面和到店优惠卡，要求统一色调和高级感。
                </p>
              </div>

              <div className="mt-4 space-y-3">
                {previewSteps.map((step) => (
                  <div
                    key={step}
                    className="flex items-center justify-between rounded-[14px] bg-white/[0.07] px-3 py-3"
                  >
                    <span className="text-[13px] text-white/78">{step}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] text-[#30D158]">
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> 已完成
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[16px] bg-white/[0.07] p-3">
                <div className="mb-2 flex items-center gap-2 text-[13px] text-white/65">
                  <Search className="h-4 w-4" aria-hidden="true" />
                  当前约束
                </div>
                <div className="flex flex-wrap gap-2">
                  {["奶油白与深咖色", "适合门店与朋友圈", "可继续加文字"].map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-white/10 px-3 py-1 text-[12px] text-white/78"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-[22px] border border-white/10 bg-white/[0.06] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[13px] text-white/58">输出墙</p>
                  <h2 className="mt-1 text-[21px] font-semibold">首批可交付方向</h2>
                </div>
                <Image className="h-5 w-5 text-white/45" aria-hidden="true" />
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                {outputCards.map((card) => (
                  <div key={card.title} className="overflow-hidden rounded-[16px] bg-white p-2">
                    <div className={`aspect-[4/5] rounded-[12px] bg-gradient-to-br ${card.tone}`} />
                    <p className="mt-2 text-[12px] font-medium text-[#0F172A]">{card.title}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[18px] bg-white p-4 text-[#0F172A]">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold">画布精修</span>
                  <Wand2 className="h-4 w-4 text-[#007AFF]" aria-hidden="true" />
                </div>
                <div className="space-y-2">
                  {["标题层", "门店优惠信息", "社媒按钮与角标"].map((layer) => (
                    <div
                      key={layer}
                      className="rounded-[10px] bg-[#F5F7FB] px-3 py-2 text-[13px] text-[#0F172A]"
                    >
                      {layer}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 left-6 rounded-[18px] border border-[#DCEBFF] bg-white px-4 py-3 shadow-card">
        <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-[#007AFF]">Ready</p>
        <p className="mt-1 text-[14px] font-medium text-[#0F172A]">结果可继续进入编辑器与作品库</p>
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  desc,
}: {
  eyebrow: string;
  title: string;
  desc?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-[#007AFF]">{eyebrow}</p>
      <h2 className="mt-3 text-[34px] font-semibold leading-tight tracking-[-0.03em] text-[#0F172A] sm:text-[44px]">
        {title}
      </h2>
      {desc ? <p className="mt-4 text-[17px] leading-8 text-[#667085]">{desc}</p> : null}
    </div>
  );
}
