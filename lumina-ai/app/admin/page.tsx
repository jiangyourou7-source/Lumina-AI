"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Ban,
  CheckCircle2,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  X,
} from "lucide-react";

type TrendPoint = { date: string; count: number };

type AdminStats = {
  totalUsers: number;
  todayNewUsers: number;
  last7DaysNewUsers: number;
  last30DaysNewUsers: number;
  totalAccounts: number;
  activeAccounts: number;
  disabledAccounts: number;
  vipAccounts: number;
  totalImageGenerations: number;
  todayImageGenerations: number;
  last7DaysImageGenerations: number;
  last30DaysImageGenerations: number;
  registrationTrend: TrendPoint[];
  generationTrend: TrendPoint[];
};

type AdminUser = {
  id: number;
  email: string;
  phone: string | null;
  nickname: string | null;
  avatar: string | null;
  role: string;
  vip_level: "normal" | "vip1" | "vip2" | "vip3";
  image_quota_total: number;
  image_quota_used: number;
  image_quota_remaining: number;
  status: "active" | "disabled";
  created_at: string;
  last_login_at: string | null;
};

type GenerationLog = {
  id: number;
  prompt: string | null;
  aspect_ratio: string | null;
  quality: string | null;
  image_count: number;
  status: string;
  quota_used: number;
  created_at: string;
};

const vipOptions = [
  { value: "", label: "全部等级" },
  { value: "normal", label: "普通用户" },
  { value: "vip1", label: "VIP1" },
  { value: "vip2", label: "VIP2" },
  { value: "vip3", label: "VIP3" },
];

const statusOptions = [
  { value: "", label: "全部状态" },
  { value: "active", label: "正常" },
  { value: "disabled", label: "禁用" },
];

const vipQuotaLabel: Record<string, string> = {
  normal: "普通",
  vip1: "VIP1 / 50张",
  vip2: "VIP2 / 100张",
  vip3: "VIP3 / 500张",
};

async function apiJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    ...options,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail || data?.error || "请求失败";
    const error = new Error(detail) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data as T;
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function AdminPage() {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [vipLevel, setVipLevel] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [logUser, setLogUser] = useState<AdminUser | null>(null);
  const [logs, setLogs] = useState<GenerationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const loadStats = useCallback(async () => {
    const data = await apiJson<AdminStats>("/api/admin/stats");
    setStats(data);
  }, []);

  const loadUsers = useCallback(async () => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
    if (keyword.trim()) params.set("keyword", keyword.trim());
    if (vipLevel) params.set("vipLevel", vipLevel);
    if (status) params.set("status", status);
    const data = await apiJson<{ items: AdminUser[]; total: number }>(`/api/admin/users?${params}`);
    setUsers(data.items);
    setTotal(data.total);
  }, [keyword, page, status, vipLevel]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      await Promise.all([loadStats(), loadUsers()]);
    } catch (err) {
      const statusCode = (err as Error & { status?: number }).status;
      if (statusCode === 401) {
        router.replace("/login?next=/admin");
        return;
      }
      setError(err instanceof Error ? err.message : "后台数据加载失败");
    } finally {
      setLoading(false);
    }
  }, [loadStats, loadUsers, router]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const openLogs = async (user: AdminUser) => {
    setLogUser(user);
    setLogs([]);
    setLogsLoading(true);
    try {
      const data = await apiJson<{ items: GenerationLog[] }>(`/api/admin/users/${user.id}/generation-logs?pageSize=50`);
      setLogs(data.items);
    } catch (err) {
      setError(err instanceof Error ? err.message : "生成记录加载失败");
    } finally {
      setLogsLoading(false);
    }
  };

  const updateVip = async (user: AdminUser, nextLevel: "vip1" | "vip2" | "vip3") => {
    const updated = await apiJson<AdminUser>(`/api/admin/users/${user.id}/vip-level`, {
      method: "POST",
      body: JSON.stringify({ vipLevel: nextLevel }),
    });
    setUsers((items) => items.map((item) => (item.id === user.id ? updated : item)));
    void loadStats();
  };

  const toggleStatus = async (user: AdminUser) => {
    const action = user.status === "active" ? "disable" : "enable";
    await apiJson(`/api/admin/users/${user.id}/${action}`, { method: "POST", body: JSON.stringify({}) });
    setUsers((items) =>
      items.map((item) =>
        item.id === user.id ? { ...item, status: action === "disable" ? "disabled" : "active" } : item
      )
    );
    void loadStats();
  };

  const chartMax = useMemo(() => {
    const points = [...(stats?.registrationTrend || []), ...(stats?.generationTrend || [])];
    return Math.max(1, ...points.map((point) => point.count));
  }, [stats]);

  if (loading && !stats) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F8FAFC] text-[#0F172A]">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在加载后台数据
      </main>
    );
  }

  if (error && !stats) {
    return (
      <main className="flex min-h-[calc(100vh-64px)] items-center justify-center bg-[#F8FAFC] px-6">
        <div className="max-w-md rounded-[8px] border border-red-100 bg-white p-6 text-center text-[#D70015] shadow-card">
          {error || "无权限访问"}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#F8FAFC] px-6 py-6 text-[#0F172A]">
      <div className="mx-auto max-w-[1480px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[13px] font-semibold text-[#2563EB]">Admin</p>
            <h1 className="text-[26px] font-semibold">后台管理</h1>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="inline-flex h-10 items-center gap-2 rounded-[8px] border border-[#D7E3F3] bg-white px-4 text-[14px] font-medium hover:bg-[#F1F7FF]"
          >
            <RefreshCw className="h-4 w-4" />
            刷新
          </button>
        </div>

        {error ? <div className="mb-4 rounded-[8px] border border-red-100 bg-white p-3 text-[14px] text-[#D70015]">{error}</div> : null}

        {stats ? (
          <>
            <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <StatTile title="总注册量" value={stats.totalUsers} sub={`今日 +${stats.todayNewUsers}`} />
              <StatTile title="近7天注册" value={stats.last7DaysNewUsers} sub={`近30天 +${stats.last30DaysNewUsers}`} />
              <StatTile title="账号总数" value={stats.totalAccounts} sub={`正常 ${stats.activeAccounts} / 禁用 ${stats.disabledAccounts}`} />
              <StatTile title="VIP账号" value={stats.vipAccounts} sub="VIP1 / VIP2 / VIP3" />
              <StatTile title="生成总次数" value={stats.totalImageGenerations} sub={`今日 ${stats.todayImageGenerations}`} />
            </section>

            <section className="mt-4 grid gap-4 lg:grid-cols-2">
              <TrendChart title="近 7 天注册趋势" data={stats.registrationTrend} max={chartMax} tone="blue" />
              <TrendChart title="近 7 天图片生成趋势" data={stats.generationTrend} max={chartMax} tone="green" />
            </section>
          </>
        ) : null}

        <section className="mt-4 rounded-[8px] border border-[#E2E8F0] bg-white">
          <div className="border-b border-[#E2E8F0] p-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[260px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" />
                <input
                  value={keyword}
                  onChange={(event) => {
                    setKeyword(event.target.value);
                    setPage(1);
                  }}
                  placeholder="搜索手机号、邮箱、昵称、用户 ID"
                  className="h-10 w-full rounded-[8px] border border-[#D7E3F3] pl-9 pr-3 text-[14px] outline-none focus:border-[#2563EB]"
                />
              </div>
              <select
                value={vipLevel}
                onChange={(event) => {
                  setVipLevel(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-[8px] border border-[#D7E3F3] bg-white px-3 text-[14px]"
              >
                {vipOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-[8px] border border-[#D7E3F3] bg-white px-3 text-[14px]"
              >
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[1180px] w-full text-left text-[13px]">
              <thead className="bg-[#F8FAFC] text-[#64748B]">
                <tr>
                  <th className="px-4 py-3 font-medium">用户</th>
                  <th className="px-4 py-3 font-medium">联系方式</th>
                  <th className="px-4 py-3 font-medium">注册时间</th>
                  <th className="px-4 py-3 font-medium">最近登录</th>
                  <th className="px-4 py-3 font-medium">权限等级</th>
                  <th className="px-4 py-3 font-medium">额度</th>
                  <th className="px-4 py-3 font-medium">状态</th>
                  <th className="px-4 py-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EEF2F7]">
                {users.map((user) => (
                  <tr key={user.id} className="hover:bg-[#FBFDFF]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[#EAF3FF] text-[#2563EB]">
                          {user.avatar ? <img src={user.avatar} alt="" className="h-full w-full object-cover" /> : <UserCog className="h-4 w-4" />}
                        </div>
                        <div>
                          <p className="font-semibold text-[#0F172A]">#{user.id} {user.nickname || "未命名用户"}</p>
                          <p className="text-[#94A3B8]">{user.role === "admin" ? "管理员" : "用户"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">
                      <p>{user.email || "-"}</p>
                      <p>{user.phone || "-"}</p>
                    </td>
                    <td className="px-4 py-3 text-[#475569]">{formatDate(user.created_at)}</td>
                    <td className="px-4 py-3 text-[#475569]">{formatDate(user.last_login_at)}</td>
                    <td className="px-4 py-3">
                      <select
                        value={user.vip_level}
                        onChange={(event) => {
                          const value = event.target.value;
                          if (value === "vip1" || value === "vip2" || value === "vip3") {
                            void updateVip(user, value);
                          }
                        }}
                        className="h-9 rounded-[8px] border border-[#D7E3F3] bg-white px-2 text-[13px]"
                      >
                        <option value="normal">普通用户</option>
                        <option value="vip1">VIP1 / 50张</option>
                        <option value="vip2">VIP2 / 100张</option>
                        <option value="vip3">VIP3 / 500张</option>
                      </select>
                      <p className="mt-1 text-[#94A3B8]">{vipQuotaLabel[user.vip_level]}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{user.image_quota_remaining} / {user.image_quota_total}</p>
                      <p className="text-[#94A3B8]">已生成 {user.image_quota_used}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-medium ${
                        user.status === "active" ? "bg-[#ECFDF3] text-[#067647]" : "bg-[#FEF3F2] text-[#B42318]"
                      }`}>
                        {user.status === "active" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                        {user.status === "active" ? "正常" : "禁用"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void openLogs(user)}
                          className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#EFF6FF] px-2.5 text-[#2563EB]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          记录
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggleStatus(user)}
                          className="inline-flex h-8 items-center gap-1 rounded-[8px] bg-[#F8FAFC] px-2.5 text-[#475569] hover:bg-[#EEF2F7]"
                        >
                          {user.status === "active" ? "禁用" : "启用"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-[#94A3B8]">暂无用户数据</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between border-t border-[#E2E8F0] px-4 py-3 text-[13px] text-[#64748B]">
            <span>共 {total} 个账号</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-[8px] border border-[#D7E3F3] px-3 py-1.5 disabled:opacity-40">上一页</button>
              <span>{page} / {totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))} className="rounded-[8px] border border-[#D7E3F3] px-3 py-1.5 disabled:opacity-40">下一页</button>
            </div>
          </div>
        </section>
      </div>

      {logUser ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/35 p-6">
          <div className="max-h-[82vh] w-full max-w-4xl overflow-hidden rounded-[8px] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] px-5 py-4">
              <div>
                <h2 className="text-[18px] font-semibold">生成记录</h2>
                <p className="text-[13px] text-[#64748B]">#{logUser.id} {logUser.nickname || logUser.email}</p>
              </div>
              <button onClick={() => setLogUser(null)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-[#F1F5F9]">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="max-h-[62vh] overflow-y-auto p-5">
              {logsLoading ? (
                <div className="flex items-center justify-center py-10 text-[#64748B]">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  正在加载
                </div>
              ) : logs.length ? (
                <div className="space-y-2">
                  {logs.map((log) => (
                    <div key={log.id} className="rounded-[8px] border border-[#E2E8F0] p-3 text-[13px]">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold">记录 #{log.id}</span>
                        <span className={log.status === "success" ? "text-[#067647]" : "text-[#B42318]"}>
                          {log.status === "success" ? "成功" : "失败"} / 消耗 {log.quota_used}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-[#475569]">{log.prompt || "-"}</p>
                      <p className="mt-2 text-[#94A3B8]">
                        {formatDate(log.created_at)} · {log.aspect_ratio || "-"} · {log.quality || "-"} · {log.image_count} 张
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-10 text-center text-[#94A3B8]">暂无生成记录</div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

function StatTile({ title, value, sub }: { title: string; value: number; sub: string }) {
  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[13px] text-[#64748B]">{title}</p>
        <ShieldCheck className="h-4 w-4 text-[#2563EB]" />
      </div>
      <p className="text-[28px] font-semibold leading-none">{value}</p>
      <p className="mt-2 text-[12px] text-[#94A3B8]">{sub}</p>
    </div>
  );
}

function TrendChart({ title, data, max, tone }: { title: string; data: TrendPoint[]; max: number; tone: "blue" | "green" }) {
  const color = tone === "blue" ? "bg-[#2563EB]" : "bg-[#16A34A]";
  return (
    <div className="rounded-[8px] border border-[#E2E8F0] bg-white p-4">
      <h2 className="mb-4 text-[15px] font-semibold">{title}</h2>
      <div className="flex h-44 items-end gap-2">
        {data.map((point) => (
          <div key={point.date} className="flex flex-1 flex-col items-center gap-2">
            <div className="flex h-32 w-full items-end rounded-[6px] bg-[#F1F5F9]">
              <div
                className={`w-full rounded-[6px] ${color}`}
                style={{ height: `${Math.max(4, (point.count / max) * 100)}%` }}
                title={`${point.date}: ${point.count}`}
              />
            </div>
            <span className="text-[11px] text-[#94A3B8]">{point.date.slice(5)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
