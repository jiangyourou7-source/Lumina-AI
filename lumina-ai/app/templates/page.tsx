"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { TemplateCard } from "@/components/TemplateCard";
import { getTemplateImageUrl, templateCategories, templates } from "@/lib/templates";

export default function TemplatesPage() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = templates.filter((template) => {
    const matchCat = activeCat === "all" || template.category === activeCat;
    const keyword = search.trim();
    const matchSearch =
      !keyword || template.title.includes(keyword) || template.prompt.includes(keyword);
    return matchCat && matchSearch;
  });

  const handleUseTemplate = (prompt: string) => {
    localStorage.setItem(
      "lumina-studio-draft",
      JSON.stringify({
        model: "gpt-image-2",
        prompt,
        resolution: "1k",
        aspectRatio: "1:1",
        imageCount: 1,
        officialFallback: true,
        referenceImage: null,
        referenceFileName: null,
      })
    );
    router.push("/studio");
  };

  return (
    <div className="max-w-desktop mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-h1 mb-2">模板库</h1>
        <p className="text-body text-text-secondary">
          50 个专业模板，覆盖商业出图、餐饮零售、品牌营销、节日活动与企业宣传。
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="flex items-center gap-2 flex-wrap">
          {templateCategories.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCat(cat.key)}
              className={`px-4 py-2 rounded-[10px] text-[15px] transition-all duration-200 ${
                activeCat === cat.key
                  ? "bg-brand-primary text-white"
                  : "bg-[#F5F5F7] text-text-secondary hover:bg-[#E8E8ED]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索模板..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full h-11 pl-9 pr-4 rounded-apple border border-[#D1D1D6] text-[15px] input-focus-ring"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map((template) => (
          <TemplateCard
            key={template.id}
            category={template.categoryLabel}
            title={template.title}
            prompt={template.prompt}
            imageUrl={getTemplateImageUrl(template.storagePath)}
            onUse={() => handleUseTemplate(template.prompt)}
          />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-24">
          <p className="text-body text-text-secondary">未找到匹配的模板</p>
        </div>
      )}
    </div>
  );
}
