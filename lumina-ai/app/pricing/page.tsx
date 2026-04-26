"use client";

import { Check } from "lucide-react";
import { Card } from "@/components/Card";
import { AppleButton } from "@/components/AppleButton";
import Link from "next/link";

const plans = [
  {
    name: "免费版",
    price: "0",
    period: "月",
    desc: "适合个人体验",
    features: [
      "每月 20 次图像生成",
      "基础模板库访问",
      "标准画质输出",
      "社区支持",
    ],
    highlighted: false,
    cta: "免费开始",
    href: "/studio",
  },
  {
    name: "专业版",
    price: "99",
    period: "月",
    desc: "适合独立创作者",
    features: [
      "每月 500 次图像生成",
      "全部 50+ 模板",
      "高清 2K 输出",
      "多轮图像编辑",
      "作品库无限存储",
      "优先客服支持",
    ],
    highlighted: true,
    cta: "立即订阅",
    href: "/studio",
  },
  {
    name: "企业版",
    price: "499",
    period: "月",
    desc: "适合团队与机构",
    features: [
      "无限图像生成",
      "全部模板 + 自定义模板",
      "4K 超高清输出",
      "团队协作空间",
      "API 接口对接",
      "专属客户经理",
      "商业授权保障",
    ],
    highlighted: false,
    cta: "联系我们",
    href: "/studio",
  },
];

export default function PricingPage() {
  return (
    <div className="max-w-desktop mx-auto px-6 py-12">
      <div className="text-center mb-16">
        <h1 className="text-h1 mb-4">选择适合你的方案</h1>
        <p className="text-body text-text-secondary max-w-xl mx-auto">
          从小白到专业团队，Lumina AI 为你提供灵活的选择
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            padding="lg"
            hover={false}
            className={`relative ${
              plan.highlighted
                ? "ring-2 ring-brand-primary shadow-card-hover"
                : ""
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-brand-primary text-white text-[13px] font-medium px-4 py-1 rounded-full">
                最受欢迎
              </div>
            )}

            <div className="text-center mb-6">
              <h3 className="text-h3 mb-1">{plan.name}</h3>
              <p className="text-caption text-text-secondary">{plan.desc}</p>
            </div>

            <div className="text-center mb-8">
              <span className="text-[48px] font-semibold text-text-primary leading-none">
                ¥{plan.price}
              </span>
              <span className="text-caption text-text-secondary">
                /{plan.period}
              </span>
            </div>

            <ul className="space-y-3 mb-8">
              {plan.features.map((f) => (
                <li key={f} className="flex items-center gap-3 text-[15px] text-text-secondary">
                  <Check className="w-5 h-5 text-semantic-success shrink-0" />
                  {f}
                </li>
              ))}
            </ul>

            <Link href={plan.href} className="block no-underline">
              <AppleButton
                variant={plan.highlighted ? "primary" : "secondary"}
                size="md"
                className="w-full"
              >
                {plan.cta}
              </AppleButton>
            </Link>
          </Card>
        ))}
      </div>

      <div className="text-center mt-16">
        <p className="text-caption text-text-tertiary">
          所有价格均为含税价格。支持支付宝、微信支付、对公转账。
        </p>
      </div>
    </div>
  );
}
