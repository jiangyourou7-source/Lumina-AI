"use client";

import { ImageIcon } from "lucide-react";
import { Card } from "./Card";

interface TemplateCardProps {
  category: string;
  title: string;
  prompt: string;
  imageUrl?: string;
  onUse?: () => void;
  onPreview?: () => void;
}

const categoryColors: Record<string, string> = {
  电商类: "from-blue-50 to-indigo-100",
  餐饮零售: "from-orange-50 to-amber-100",
  品牌营销: "from-purple-50 to-pink-100",
  节日活动: "from-red-50 to-rose-100",
  企业宣传: "from-emerald-50 to-teal-100",
};

export function TemplateCard({ category, title, prompt, imageUrl, onUse, onPreview }: TemplateCardProps) {
  const gradientClass = categoryColors[category] || "from-gray-50 to-gray-100";

  return (
    <Card hover padding="sm">
      <div className={`aspect-[4/3] rounded-[12px] overflow-hidden mb-4 bg-gradient-to-br ${gradientClass}`}>
        {imageUrl ? (
          <div className="group/image block h-full w-full">
            <img
              src={imageUrl}
              alt={title}
              onClick={() => {
                console.log("preview image clicked", imageUrl);
                onPreview?.();
              }}
              className="h-full w-full cursor-pointer object-cover transition duration-200 ease-out group-hover/image:scale-[1.03] group-hover/image:brightness-90"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-black/25">
            <ImageIcon className="h-7 w-7" />
            <span className="text-[13px] font-medium">{category}</span>
          </div>
        )}
      </div>
      <div className="space-y-2 px-1">
        <span className="text-[13px] font-medium text-brand-primary tracking-wide">
          {category}
        </span>
        <h3 className="text-[17px] font-semibold text-text-primary leading-snug">
          {title}
        </h3>
        <p className="text-[13px] text-text-secondary leading-relaxed line-clamp-2">
          {prompt}
        </p>
      </div>
      <button
        onClick={onUse}
        className="mt-4 w-full py-2.5 rounded-[10px] border border-brand-primary text-brand-primary text-[15px] font-medium hover:bg-brand-primary/5 active:scale-[0.98] transition-all duration-200"
      >
        一键套用
      </button>
    </Card>
  );
}
