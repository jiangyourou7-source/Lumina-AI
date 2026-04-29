"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { resetPasswordWithEmailCode, sendEmailCode } from "@/lib/openai-proxy";

function onlyDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSendCode() {
    setMessage("");
    setError("");
    if (!email.trim()) {
      setError("请先输入邮箱。");
      return;
    }
    setSending(true);
    try {
      const result = await sendEmailCode(email.trim(), "reset_password");
      setMessage(result.message || "验证码已发送，请查看邮箱。");
      setCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "验证码发送失败");
    } finally {
      setSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    if (emailCode.length !== 6) {
      setError("请输入 6 位邮箱验证码。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致。");
      return;
    }

    setLoading(true);
    try {
      const result = await resetPasswordWithEmailCode(email.trim(), emailCode, newPassword);
      setMessage(result.message || "密码已更新，请返回登录。");
      setEmailCode("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "重置密码失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F5F7] px-6 py-12">
      <div className="mx-auto max-w-[520px] rounded-[24px] border border-black/5 bg-white p-6 shadow-card-hover sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <BrandLogo className="h-10 w-10" />
          <div>
            <p className="text-[13px] font-medium text-[#86868B]">{BRAND_NAME}</p>
            <h1 className="text-[28px] font-semibold text-[#1D1D1F]">重置密码</h1>
          </div>
        </div>

        <p className="mb-6 text-[15px] leading-7 text-[#6B7280]">
          输入注册邮箱并获取 6 位验证码，验证码 5 分钟内有效。
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-[14px] font-medium text-[#1D1D1F]">
            邮箱
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              autoComplete="email"
              required
              className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="block text-[14px] font-medium text-[#1D1D1F]">
              邮箱验证码
              <input
                value={emailCode}
                onChange={(event) => setEmailCode(onlyDigits(event.target.value, 6))}
                inputMode="numeric"
                placeholder="6 位数字"
                required
                className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
              />
            </label>
            <button
              type="button"
              onClick={() => void handleSendCode()}
              disabled={sending || cooldown > 0}
              className="mt-7 h-12 w-[142px] rounded-[12px] border border-[#007AFF]/25 bg-[#EFF6FF] px-3 text-[13px] font-semibold text-[#007AFF] transition hover:bg-[#E5F2FF] disabled:cursor-not-allowed disabled:opacity-55"
            >
              {sending ? "发送中..." : cooldown > 0 ? `${cooldown} 秒后重发` : "获取验证码"}
            </button>
          </div>

          <label className="block text-[14px] font-medium text-[#1D1D1F]">
            新密码
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="至少 8 位"
              minLength={8}
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
              autoComplete="new-password"
              required
              className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
            />
          </label>

          {message && (
            <div className="rounded-[12px] border border-[#30D158]/20 bg-[#30D158]/10 px-4 py-3 text-[14px] text-[#1D7A35]">
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
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            确认重置
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
