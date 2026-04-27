"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X, Download, FolderOpen, Trash2 } from "lucide-react";
import { Card } from "@/components/Card";
import { Modal } from "@/components/Modal";
import { AppleButton } from "@/components/AppleButton";
import { deleteGalleryItem, getGallery } from "@/lib/openai-proxy";
import { AUTH_REQUIRED_MESSAGE } from "@/lib/auth-constants";

interface GalleryItem {
  id: string;
  serverId?: number;
  url: string;
  title: string;
  prompt: string;
  createdAt: string;
  category: string;
}

const GALLERY_KEY = "lumina-gallery";
const categories = ["全部", "电商", "餐饮", "品牌", "节日", "企业", "其他"];

const defaultGallery: GalleryItem[] = Array.from({ length: 24 }, (_, i) => ({
  id: String(i + 1),
  url: `https://picsum.photos/seed/lumina${i + 1}/800/800`,
  title: `示例作品 ${i + 1}`,
  prompt: "现代简约风格，白色背景，产品摄影",
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  category: ["电商", "餐饮", "品牌", "节日", "企业"][i % 5],
}));

export default function GalleryPage() {
  const router = useRouter();
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("全部");
  const [page, setPage] = useState(1);

  useEffect(() => {
    let mounted = true;

    async function loadGallery() {
      setLoading(true);
      try {
        const data = await getGallery(undefined, 100, 0);
        if (!mounted) return;
        setItems(
          data.items.map((item) => ({
            id: `server-${item.id}`,
            serverId: item.id,
            url: item.url,
            title: item.title,
            prompt: item.prompt || "",
            createdAt: item.created_at,
            category: item.category,
          }))
        );
      } catch (error) {
        if (!mounted) return;
        if (error instanceof Error && error.message === AUTH_REQUIRED_MESSAGE) {
          router.replace("/login?next=/gallery");
          return;
        }
        const localGallery = getLocalGallery();
        setItems([...localGallery, ...defaultGallery]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadGallery();
    return () => {
      mounted = false;
    };
  }, [router]);

  function getLocalGallery(): GalleryItem[] {
    try {
      return JSON.parse(localStorage.getItem(GALLERY_KEY) || "[]");
    } catch {
      return [];
    }
  }

  const filtered = items.filter((item) => {
    const matchCat = activeCategory === "全部" || item.category === activeCategory;
    const matchSearch =
      !search ||
      item.title.includes(search) ||
      item.prompt.includes(search);
    return matchCat && matchSearch;
  });

  const displayed = filtered.slice(0, page * 12);
  const hasMore = displayed.length < filtered.length;

  const loadMore = useCallback(() => {
    setPage((p) => p + 1);
  }, []);

  const handleDownload = async (url: string, title: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${title}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(url, "_blank");
    }
  };

  const handleDelete = async (item: GalleryItem) => {
    if (item.serverId) {
      await deleteGalleryItem(item.serverId);
    } else {
      const localGallery = getLocalGallery();
      const updated = localGallery.filter((localItem: GalleryItem) => localItem.id !== item.id);
      localStorage.setItem(GALLERY_KEY, JSON.stringify(updated));
    }

    setItems((prev) => prev.filter((prevItem) => prevItem.id !== item.id));
    setSelected(null);
  };

  return (
    <div className="max-w-desktop mx-auto px-6 py-12">
      <div className="mb-10">
        <h1 className="text-h1 mb-2">作品库</h1>
        <p className="text-body text-text-secondary">
          管理你的所有 AI 创作成果
        </p>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-8">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-tertiary" />
          <input
            type="text"
            placeholder="搜索作品..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-11 pl-10 pr-4 rounded-apple border border-[#D1D1D6] text-[15px] input-focus-ring"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              <X className="w-4 h-4 text-text-tertiary" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setActiveCategory(cat);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-[10px] text-[15px] transition-all duration-200 ${
                activeCategory === cat
                  ? "bg-brand-primary text-white"
                  : "bg-[#F5F5F7] text-text-secondary hover:bg-[#E8E8ED]"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-square rounded-image bg-[#F5F5F7] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-24">
          <FolderOpen className="w-16 h-16 text-text-tertiary mx-auto mb-4" />
          <p className="text-body text-text-secondary">暂无作品</p>
          <p className="text-caption text-text-tertiary mt-1">去创作工作台开始创作吧</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {displayed.map((item) => (
              <button
                key={item.id}
                onClick={() => setSelected(item)}
                className="text-left group"
              >
                <Card hover padding="sm" className="h-full">
                  <div className="aspect-square rounded-[12px] overflow-hidden mb-3 bg-[#F5F5F7]">
                    <img
                      src={item.url}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                  </div>
                  <h3 className="text-[15px] font-medium text-text-primary truncate">
                    {item.title}
                  </h3>
                  <p className="text-[13px] text-text-tertiary mt-1">
                    {item.category}
                  </p>
                </Card>
              </button>
            ))}
          </div>

          {hasMore && (
            <div className="text-center mt-12">
              <AppleButton variant="secondary" size="md" onClick={loadMore}>
                加载更多
              </AppleButton>
            </div>
          )}
        </>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        size="md"
      >
        {selected && (
          <div>
            <img
              src={selected.url}
              alt={selected.title}
              className="w-full rounded-image mb-6"
            />
            <h2 className="text-h2 mb-2">{selected.title}</h2>
            <p className="text-body text-text-secondary mb-1">{selected.prompt}</p>
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[13px] text-text-tertiary">
                {selected.category}
              </span>
              <span className="text-[13px] text-text-tertiary">·</span>
              <span className="text-[13px] text-text-tertiary">
                {new Date(selected.createdAt).toLocaleDateString("zh-CN")}
              </span>
            </div>
            <div className="flex gap-3">
              <AppleButton
                size="sm"
                onClick={() => handleDownload(selected.url, selected.title)}
              >
                <Download className="w-4 h-4" /> 下载高清
              </AppleButton>
              <AppleButton
                size="sm"
                variant="ghost"
                onClick={() => handleDelete(selected)}
              >
                <Trash2 className="w-4 h-4" /> 删除
              </AppleButton>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
