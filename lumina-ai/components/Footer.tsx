import Link from "next/link";
import { Sparkles } from "lucide-react";

export function Footer() {
  return (
    <footer className="border-t border-black/5 bg-white mt-32">
      <div className="max-w-desktop mx-auto px-6 py-16 grid grid-cols-1 md:grid-cols-4 gap-12">
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-brand-primary" />
            <span className="font-semibold text-h3">Lumina AI</span>
          </div>
          <p className="text-caption text-text-secondary">
            专业级AI图像创作平台，让你的商业视觉脱颖而出
          </p>
        </div>

        <div>
          <h4 className="text-[15px] font-medium mb-4">产品</h4>
          <div className="space-y-3">
            <Link href="/studio" className="block text-caption text-text-secondary hover:text-text-primary no-underline">创作工作室</Link>
            <Link href="/editor" className="block text-caption text-text-secondary hover:text-text-primary no-underline">图像编辑</Link>
            <Link href="/templates" className="block text-caption text-text-secondary hover:text-text-primary no-underline">模板库</Link>
            <Link href="/gallery" className="block text-caption text-text-secondary hover:text-text-primary no-underline">作品库</Link>
          </div>
        </div>

        <div>
          <h4 className="text-[15px] font-medium mb-4">支持</h4>
          <div className="space-y-3">
            <span className="block text-caption text-text-tertiary">帮助中心</span>
            <span className="block text-caption text-text-tertiary">联系我们</span>
          </div>
        </div>

        <div>
          <h4 className="text-[15px] font-medium mb-4">法律</h4>
          <div className="space-y-3">
            <span className="block text-caption text-text-tertiary">隐私政策</span>
            <span className="block text-caption text-text-tertiary">服务条款</span>
          </div>
        </div>
      </div>

      <div className="max-w-desktop mx-auto px-6 pb-8 text-center">
        <p className="text-caption text-text-tertiary">
          © 2026 Lumina AI. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
