"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Check, ImagePlus, LayoutDashboard, LogOut, UserRound } from "lucide-react";
import { getUserProfile, isAuthenticated, logout } from "@/lib/openai-proxy";

interface ProfileState {
  user: {
    email: string;
    name: string | null;
    plan: string;
  };
  quota: {
    total: number;
    used: number;
    remaining: number;
    plan: string;
  };
}

const TOP_UP_OPTIONS = [
  { id: "starter", price: "¥9.9", credits: "50 张", unit: "约 ¥0.20/张" },
  { id: "standard", price: "¥99.9", credits: "500 张", unit: "约 ¥0.20/张" },
  { id: "business", price: "¥499.9", credits: "2800 张", unit: "约 ¥0.18/张" },
];

function getPlanLabel(plan: string) {
  if (plan === "free") return "免费套餐";
  if (plan === "pro") return "专业套餐";
  if (plan === "enterprise") return "企业套餐";
  return plan;
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTopUp, setSelectedTopUp] = useState(TOP_UP_OPTIONS[0].id);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.replace("/login?next=/settings");
      return;
    }

    getUserProfile()
      .then((data) => setProfile(data as ProfileState))
      .catch((err) => setError(err instanceof Error ? err.message : "获取账号信息失败"))
      .finally(() => setLoading(false));
  }, [router]);

  const quotaPercent = useMemo(() => {
    if (!profile?.quota.total) return 0;
    return Math.min(100, Math.round((profile.quota.used / profile.quota.total) * 100));
  }, [profile]);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleContactAuthor = () => {
    window.location.href =
      "mailto:demo@drmine.ai?subject=Drmine%20AI%20%E5%AE%9A%E5%88%B6%E5%85%85%E5%80%BC";
  };

  const planLabel = profile ? getPlanLabel(profile.user.plan || profile.quota.plan || "free") : "";

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#f8fafc] px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8">
          <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.16em] text-brand-primary">Account</p>
          <h1 className="text-h1 text-[#0f172a]">账号设置</h1>
        </div>

        {loading ? (
          <div className="rounded-[18px] border border-black/5 bg-white p-8 text-text-secondary shadow-card">
            正在加载账号信息...
          </div>
        ) : error ? (
          <div className="rounded-[18px] border border-red-100 bg-white p-8 text-[#d70015] shadow-card">
            {error}
          </div>
        ) : profile ? (
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[18px] border border-black/5 bg-white p-6 shadow-card">
              <div className="mb-6 flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#eef5ff] text-brand-primary">
                  <UserRound className="h-7 w-7" />
                </div>
                <div>
                  <h2 className="text-[22px] font-semibold text-[#0f172a]">
                    {profile.user.name || profile.user.email.split("@")[0]}
                  </h2>
                  <p className="text-[15px] text-text-secondary">{profile.user.email}</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <InfoTile label="当前套餐" value={planLabel} />
                <InfoTile label="剩余额度" value={`${profile.quota.remaining}/${profile.quota.total}`} />
              </div>

              <div className="mt-6 rounded-[14px] bg-[#f8fafc] p-4">
                <div className="mb-2 flex items-center justify-between text-[13px] text-text-secondary">
                  <span>本周期已用</span>
                  <span>{quotaPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div className="h-full rounded-full bg-brand-primary" style={{ width: `${quotaPercent}%` }} />
                </div>
              </div>

              <div className="mt-6 border-t border-black/5 pt-6">
                <div className="grid gap-3 sm:grid-cols-2">
                  {TOP_UP_OPTIONS.map((option) => {
                    const selected = selectedTopUp === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setSelectedTopUp(option.id)}
                        className={`rounded-[14px] border p-4 text-left transition ${
                          selected
                            ? "border-brand-primary bg-[#f0f7ff] shadow-sm"
                            : "border-black/5 bg-[#f8fafc] hover:border-brand-primary/30 hover:bg-white"
                        }`}
                      >
                        <div className="mb-3 flex items-start justify-between gap-3">
                          <div>
                            <p className="text-[22px] font-semibold text-[#0f172a]">{option.price}</p>
                          </div>
                          {selected ? (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-primary text-white">
                              <Check className="h-3.5 w-3.5" />
                            </span>
                          ) : null}
                        </div>
                        <div className="flex items-end justify-between">
                          <span className="text-[18px] font-semibold text-[#0f172a]">{option.credits}</span>
                          <span className="text-[12px] text-text-secondary">{option.unit}</span>
                        </div>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={handleContactAuthor}
                    className="rounded-[14px] border border-dashed border-brand-primary/35 bg-white p-4 text-left transition hover:border-brand-primary hover:bg-[#f8fbff]"
                  >
                    <div className="flex h-full min-h-[84px] items-center justify-between gap-4">
                      <span className="text-[18px] font-semibold text-brand-primary">联系作者定制</span>
                      <ArrowRight className="h-4 w-4 text-brand-primary" />
                    </div>
                  </button>
                </div>
              </div>
            </section>

            <aside className="space-y-3">
              <QuickLink href="/studio" icon={<ImagePlus className="h-4 w-4" />} title="创作工作室" />
              <QuickLink href="/editor" icon={<LayoutDashboard className="h-4 w-4" />} title="画布编辑" />
              <QuickLink href="/gallery" icon={<ArrowRight className="h-4 w-4" />} title="作品库" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center justify-between rounded-[14px] border border-black/5 bg-white px-4 py-4 text-left text-[#d70015] shadow-sm transition hover:border-red-100 hover:bg-[#fff7f7]"
              >
                <span className="inline-flex items-center gap-3 text-[15px] font-medium">
                  <LogOut className="h-4 w-4" />
                  退出登录
                </span>
              </button>
            </aside>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[14px] bg-[#f8fafc] p-4">
      <p className="mb-1 text-[13px] text-text-secondary">{label}</p>
      <p className="text-[20px] font-semibold text-[#0f172a]">{value}</p>
    </div>
  );
}

function QuickLink({ href, icon, title }: { href: string; icon: ReactNode; title: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center justify-between rounded-[14px] border border-black/5 bg-white px-4 py-4 text-[#0f172a] no-underline shadow-sm transition hover:border-brand-primary/20 hover:bg-[#f8fbff]"
    >
      <span className="inline-flex items-center gap-3 text-[15px] font-medium">
        {icon}
        {title}
      </span>
      <ArrowRight className="h-4 w-4 text-text-tertiary" />
    </Link>
  );
}
