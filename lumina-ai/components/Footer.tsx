"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME, SUPPORT_EMAIL } from "@/lib/brand";

export function Footer() {
  const pathname = usePathname();
  const year = new Date().getFullYear();

  if (pathname === "/editor") {
    return null;
  }

  return (
    <footer className="mt-24 border-t border-black/5 bg-white">
      <div className="max-w-desktop mx-auto grid grid-cols-1 gap-12 px-6 py-16 md:grid-cols-4">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <BrandLogo className="h-6 w-6" />
            <span className="font-semibold text-h3">{BRAND_NAME}</span>
          </div>
          <p className="text-caption text-text-secondary">
            面向商业场景的 AI 视觉工作台，把生成、精修和资产沉淀放进同一条工作流。
          </p>
        </div>

        <div>
          <h4 className="mb-4 text-[15px] font-medium">产品</h4>
          <div className="space-y-3">
            <Link href="/studio" className="block text-caption text-text-secondary no-underline hover:text-text-primary">创作工作台</Link>
            <Link href="/editor" className="block text-caption text-text-secondary no-underline hover:text-text-primary">画布编辑</Link>
            <Link href="/templates" className="block text-caption text-text-secondary no-underline hover:text-text-primary">模板库</Link>
            <Link href="/gallery" className="block text-caption text-text-secondary no-underline hover:text-text-primary">作品库</Link>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-[15px] font-medium">支持</h4>
          <div className="space-y-3">
            <Link href="/forgot-password" className="block text-caption text-text-secondary no-underline hover:text-text-primary">重置密码</Link>
            <a href={`mailto:${SUPPORT_EMAIL}`} className="block text-caption text-text-secondary no-underline hover:text-text-primary">联系作者</a>
          </div>
        </div>

        <div>
          <h4 className="mb-4 text-[15px] font-medium">状态</h4>
          <div className="space-y-3">
            <span className="block text-caption text-text-tertiary">MVP 持续迭代中</span>
            <span className="block text-caption text-text-tertiary">支付与条款页尚未接入</span>
          </div>
        </div>
      </div>

      <div className="max-w-desktop mx-auto px-6 pb-8 text-center">
        <p className="text-caption text-text-tertiary">© {year} {BRAND_NAME}. All rights reserved.</p>
      </div>
    </footer>
  );
}
