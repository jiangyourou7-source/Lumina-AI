"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, KeyRound } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { resetPassword } from "@/lib/openai-proxy";

export default function ResetPasswordPage() {
  const [token, setToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get("token") || "");
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (!token) {
      setError("重置链接无效或已过期");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPassword(token, password);
      setMessage(result.message);
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F5F7] px-6 py-12">
      <div className="mx-auto max-w-[480px] rounded-[24px] border border-black/5 bg-white p-6 shadow-card-hover sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo className="h-10 w-10" />
          <div>
            <p className="text-[13px] font-medium text-[#86868B]">Drmine AI</p>
            <h1 className="text-[28px] font-semibold text-[#1D1D1F]">设置新密码</h1>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-[14px] font-medium text-[#1D1D1F]">
            新密码
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="至少 8 位"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
              className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
            />
          </label>

          <label className="block text-[14px] font-medium text-[#1D1D1F]">
            确认新密码
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="再次输入新密码"
              minLength={8}
              maxLength={128}
              autoComplete="new-password"
              required
              className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
            />
          </label>

          {message && (
            <div className="flex items-center gap-2 rounded-[12px] border border-[#30D158]/20 bg-[#30D158]/10 px-4 py-3 text-[14px] text-[#1D7A35]">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </div>
          )}
          {error && (
            <div className="rounded-[12px] border border-[#FF3B30]/20 bg-[#FF3B30]/5 px-4 py-3 text-[14px] text-[#B42318]">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#007AFF] text-[15px] font-semibold text-white transition hover:bg-[#0067D8] active:scale-[0.98] disabled:opacity-60"
          >
            <KeyRound className="h-4 w-4" />
            {loading ? "提交中..." : "更新密码"}
          </button>
        </form>

        <Link
          href="/login"
          className="mt-6 inline-flex items-center gap-2 text-[14px] font-medium text-[#007AFF] no-underline"
        >
          <ArrowLeft className="h-4 w-4" />
          返回登录
        </Link>
      </div>
    </div>
  );
}
