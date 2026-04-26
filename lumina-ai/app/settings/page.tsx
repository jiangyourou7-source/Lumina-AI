"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ImagePlus, LayoutDashboard, LogOut, UserRound } from "lucide-react";
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

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
                <InfoTile label="当前套餐" value={profile.user.plan || profile.quota.plan || "free"} />
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
