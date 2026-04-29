"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Crown,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  ReceiptText,
  Sparkles,
  UserRound,
} from "lucide-react";
import { AUTH_REQUIRED_MESSAGE } from "@/lib/auth-constants";
import {
  createOrder,
  getPlans,
  getUserProfile,
  getUserQuota,
  logout,
  type GenerationLogItem,
  type PlanItem,
  type UserQuota,
} from "@/lib/openai-proxy";

interface ProfileState {
  user: {
    email: string;
    name: string | null;
    plan: string;
  };
}

const PLAN_LABELS: Record<string, string> = {
  free: "免费用户",
  vip1: "VIP1",
  vip2: "VIP2",
  vip3: "VIP3",
};

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileState | null>(null);
  const [quota, setQuota] = useState<UserQuota | null>(null);
  const [plans, setPlans] = useState<PlanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [purchaseMessage, setPurchaseMessage] = useState("");
  const [purchasingPlan, setPurchasingPlan] = useState<string | null>(null);

  const refreshQuota = async () => {
    const data = await getUserQuota();
    setQuota(data);
  };

  useEffect(() => {
    Promise.all([getUserProfile(), getUserQuota(), getPlans()])
      .then(([profileData, quotaData, planData]) => {
        setProfile(profileData as ProfileState);
        setQuota(quotaData);
        setPlans(planData);
      })
      .catch((err) => {
        if (err instanceof Error && err.message === AUTH_REQUIRED_MESSAGE) {
          router.replace("/login?next=/settings");
          return;
        }
        setError(err instanceof Error ? err.message : "获取账户信息失败");
      })
      .finally(() => setLoading(false));
  }, [router]);

  const quotaPercent = useMemo(() => {
    if (!quota?.imageQuotaTotal) return 0;
    return Math.min(100, Math.round((quota.imageQuotaUsed / quota.imageQuotaTotal) * 100));
  }, [quota]);

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const handlePurchase = async (plan: PlanItem) => {
    setPurchasingPlan(plan.plan);
    setPurchaseMessage("");
    try {
      const order = await createOrder(plan.plan, "normal");
      await refreshQuota();
      setPurchaseMessage(`订单 ${order.id} 已创建，请完成支付后等待系统自动开通。`);
    } catch (err) {
      setPurchaseMessage(err instanceof Error ? err.message : "购买失败，请稍后重试");
    } finally {
      setPurchasingPlan(null);
    }
  };

  const planLabel = quota ? PLAN_LABELS[quota.plan] || quota.planLabel || quota.plan : "";

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#f8fafc] px-5 py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-7 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-[13px] font-medium uppercase tracking-[0.16em] text-brand-primary">Account</p>
            <h1 className="text-h1 text-[#0f172a]">账户设置</h1>
          </div>
          <div className="flex items-center gap-3">
            <QuickLink href="/studio" icon={<ImagePlus className="h-4 w-4" />} title="创作" />
            <QuickLink href="/gallery" icon={<ArrowRight className="h-4 w-4" />} title="作品库" />
          </div>
        </div>

        {loading ? (
          <StatusPanel>正在加载账户信息...</StatusPanel>
        ) : error ? (
          <StatusPanel tone="error">{error}</StatusPanel>
        ) : profile && quota ? (
          <div className="space-y-6">
            <section className="rounded-[8px] border border-black/5 bg-white p-6 shadow-card">
              <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-4">
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
                <button
                  onClick={() => void handleLogout()}
                  className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-red-100 px-4 py-2 text-[14px] font-medium text-[#d70015] transition hover:bg-[#fff7f7]"
                >
                  <LogOut className="h-4 w-4" />
                  退出登录
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-4">
                <InfoTile label="当前套餐" value={planLabel} />
                <InfoTile label="总额度" value={`${quota.imageQuotaTotal} 张`} />
                <InfoTile label="已使用" value={`${quota.imageQuotaUsed} 张`} />
                <InfoTile label="剩余" value={`${quota.imageQuotaRemaining} 张`} accent />
              </div>

              <div className="mt-6">
                <div className="mb-2 flex items-center justify-between text-[13px] text-text-secondary">
                  <span>使用进度</span>
                  <span>{quotaPercent}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div className="h-full rounded-full bg-brand-primary" style={{ width: `${quotaPercent}%` }} />
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-[20px] font-semibold text-[#0f172a]">VIP 套餐</h2>
                {purchaseMessage ? (
                  <span className="text-[13px] font-medium text-brand-primary">{purchaseMessage}</span>
                ) : null}
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                {plans.map((plan) => (
                  <PlanCard
                    key={plan.plan}
                    plan={plan}
                    currentPlan={quota.plan}
                    loading={purchasingPlan === plan.plan}
                    onPurchase={() => void handlePurchase(plan)}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-[8px] border border-black/5 bg-white p-6 shadow-card">
              <div className="mb-4 flex items-center gap-2">
                <ReceiptText className="h-5 w-5 text-brand-primary" />
                <h2 className="text-[20px] font-semibold text-[#0f172a]">生成记录</h2>
              </div>
              <GenerationLogs logs={quota.recentGenerationLogs} />
            </section>

            <div className="grid gap-3 sm:grid-cols-2">
              <QuickPanel href="/studio" icon={<ImagePlus className="h-4 w-4" />} title="创作工作台" />
              <QuickPanel href="/editor" icon={<LayoutDashboard className="h-4 w-4" />} title="画布编辑" />
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

function InfoTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-[8px] bg-[#f8fafc] p-4">
      <p className="mb-1 text-[13px] text-text-secondary">{label}</p>
      <p className={`text-[20px] font-semibold ${accent ? "text-brand-primary" : "text-[#0f172a]"}`}>{value}</p>
    </div>
  );
}

function PlanCard({
  plan,
  currentPlan,
  loading,
  onPurchase,
}: {
  plan: PlanItem;
  currentPlan: string;
  loading: boolean;
  onPurchase: () => void;
}) {
  const isCurrent = currentPlan === plan.plan;
  return (
    <div className="rounded-[8px] border border-black/5 bg-white p-5 shadow-card">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Crown className="h-5 w-5 text-brand-primary" />
          <h3 className="text-[20px] font-semibold text-[#0f172a]">{plan.name}</h3>
        </div>
        {isCurrent ? <span className="text-[12px] font-medium text-brand-primary">当前套餐</span> : null}
      </div>
      <p className="mb-2 text-[30px] font-semibold text-[#0f172a]">¥{plan.price}</p>
      <p className="mb-5 text-[15px] text-text-secondary">{plan.quota} 张生图额度</p>
      <button
        type="button"
        onClick={onPurchase}
        disabled={loading}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-brand-primary px-4 text-[14px] font-medium text-white transition hover:bg-[#0066d6] disabled:opacity-60"
      >
        <Sparkles className="h-4 w-4" />
        {loading ? "处理中..." : isCurrent ? "继续购买" : "购买 / 升级"}
      </button>
    </div>
  );
}

function GenerationLogs({ logs }: { logs: GenerationLogItem[] }) {
  if (!logs.length) {
    return <div className="rounded-[8px] bg-[#f8fafc] p-5 text-[14px] text-text-secondary">暂无生成记录</div>;
  }

  return (
    <div className="overflow-hidden rounded-[8px] border border-black/5">
      <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] bg-[#f8fafc] px-4 py-3 text-[13px] font-medium text-text-secondary">
        <span>生成时间</span>
        <span>生成数量</span>
        <span>消耗额度</span>
        <span>状态</span>
      </div>
      {logs.map((log) => (
        <div
          key={log.id}
          className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] border-t border-black/5 px-4 py-3 text-[14px] text-[#0f172a]"
        >
          <span>{new Date(log.createdAt).toLocaleString("zh-CN")}</span>
          <span>{log.imageCount} 张</span>
          <span>{log.quotaUsed} 次</span>
          <span>{statusLabel(log.status)}</span>
        </div>
      ))}
    </div>
  );
}

function statusLabel(status: string) {
  if (status === "success") return "成功";
  if (status === "partial_success") return "部分成功";
  if (status === "failed") return "失败";
  return status;
}

function QuickLink({ href, icon, title }: { href: string; icon: ReactNode; title: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="inline-flex items-center gap-2 rounded-[8px] border border-black/5 bg-white px-3 py-2 text-[14px] font-medium text-[#0f172a] no-underline shadow-sm transition hover:border-brand-primary/20 hover:bg-[#f8fbff]"
    >
      {icon}
      {title}
    </Link>
  );
}

function QuickPanel({ href, icon, title }: { href: string; icon: ReactNode; title: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex items-center justify-between rounded-[8px] border border-black/5 bg-white px-4 py-4 text-[#0f172a] no-underline shadow-sm transition hover:border-brand-primary/20 hover:bg-[#f8fbff]"
    >
      <span className="inline-flex items-center gap-3 text-[15px] font-medium">
        {icon}
        {title}
      </span>
      <ArrowRight className="h-4 w-4 text-text-tertiary" />
    </Link>
  );
}

function StatusPanel({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "error" }) {
  return (
    <div
      className={`rounded-[8px] border bg-white p-8 shadow-card ${
        tone === "error" ? "border-red-100 text-[#d70015]" : "border-black/5 text-text-secondary"
      }`}
    >
      {children}
    </div>
  );
}
