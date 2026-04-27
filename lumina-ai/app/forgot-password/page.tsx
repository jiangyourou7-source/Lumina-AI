"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { requestPasswordReset } from "@/lib/openai-proxy";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const result = await requestPasswordReset(email.trim());
      setMessage(result.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送重置邮件失败");
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
            <p className="text-[13px] font-medium text-[#86868B]">{BRAND_NAME}</p>
            <h1 className="text-[28px] font-semibold text-[#1D1D1F]">忘记密码</h1>
          </div>
        </div>

        <p className="mb-6 text-[15px] leading-7 text-[#6B7280]">
          输入注册邮箱。如果该邮箱已注册，我们会发送一封密码重置邮件。
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
            <Mail className="h-4 w-4" />
            {loading ? "发送中..." : "发送重置邮件"}
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
