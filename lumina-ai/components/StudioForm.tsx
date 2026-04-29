"use client";

import { useState, useEffect, useCallback } from "react";
import { Input, Textarea } from "./Input";

const STORAGE_KEY = "lumina-studio-draft";

interface StudioFormData {
  productName: string;
  scene: string;
  style: string;
  details: string;
}

interface StudioFormProps {
  onGenerate: (data: StudioFormData) => void;
  disabled?: boolean;
}

const defaultData: StudioFormData = {
  productName: "",
  scene: "",
  style: "",
  details: "",
};

export function StudioForm({ onGenerate, disabled }: StudioFormProps) {
  const [data, setData] = useState<StudioFormData>(defaultData);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setData(JSON.parse(saved));
      } catch {}
    }
  }, []);

  const updateField = useCallback((field: keyof StudioFormData, value: string) => {
    setData((prev) => {
      const next = { ...prev, [field]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const handleSubmit = () => {
    if (data.details.trim()) {
      onGenerate(data);
    }
  };

  return (
    <div className="space-y-5">
      <Input
        label="产品名称"
        placeholder="例如：高端陶瓷咖啡杯"
        value={data.productName}
        onChange={(e) => updateField("productName", e.target.value)}
        disabled={disabled}
      />

      <Input
        label="使用场景"
        placeholder="例如：电商主图、品牌海报"
        value={data.scene}
        onChange={(e) => updateField("scene", e.target.value)}
        disabled={disabled}
      />

      <Input
        label="风格偏好"
        placeholder="例如：现代简约、中国风"
        value={data.style}
        onChange={(e) => updateField("style", e.target.value)}
        disabled={disabled}
      />

      <Textarea
        label="详细描述（Prompt）"
        placeholder="详细描述你想要的画面..."
        value={data.details}
        onChange={(e) => updateField("details", e.target.value)}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={disabled || !data.details.trim()}
        className="h-11 w-full rounded-[8px] bg-brand-primary text-[14px] font-medium text-white transition hover:bg-[#0066d6] disabled:opacity-50"
      >
        生成
      </button>
    </div>
  );
}
