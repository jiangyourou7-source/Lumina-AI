"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Loader2, RefreshCw } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME, BRAND_STUDIO_NAME } from "@/lib/brand";
import { getCaptcha, getSession, login, register, sendEmailCode } from "@/lib/openai-proxy";

type AuthMode = "login" | "register";

const previewSteps = ["分析品牌调性", "规划朋友圈版式", "生成精修主视觉"];

const previewCards = [
  { title: "电商主图", tone: "bg-[#E5F2FF]" },
  { title: "朋友圈九宫格", tone: "bg-[#F5F5F7]" },
  { title: "品牌物料", tone: "bg-[#FFF4DE]" },
];

function getSafeNextPath() {
  if (typeof window === "undefined") return "/studio";
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next") || "/studio";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/studio";
}

function onlyDigits(value: string, maxLength: number) {
  return value.replace(/\D/g, "").slice(0, maxLength);
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [nextPath, setNextPath] = useState("/studio");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [captchaId, setCaptchaId] = useState("");
  const [captchaImage, setCaptchaImage] = useState("");
  const [captchaCode, setCaptchaCode] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailCooldown, setEmailCooldown] = useState(0);
  const [emailSending, setEmailSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [loginFailures, setLoginFailures] = useState(0);

  const submitLabel = useMemo(
    () => (mode === "login" ? "登录并开始创作" : "创建账号并开始创作"),
    [mode]
  );

  async function refreshCaptcha() {
    try {
      const result = await getCaptcha();
      setCaptchaId(result.captchaId);
      setCaptchaImage(result.captchaImage);
      setCaptchaCode("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取验证码失败");
    }
  }

  useEffect(() => {
    let mounted = true;
    const safeNext = getSafeNextPath();
    const params = new URLSearchParams(window.location.search);
    const requestedMode = params.get("mode");
    if (requestedMode === "register" || requestedMode === "login") {
      setMode(requestedMode);
    }
    setNextPath(safeNext);
    void refreshCaptcha();
    void getSession().then((session) => {
      if (mounted && session) {
        router.replace(safeNext);
      }
    });
    return () => {
      mounted = false;
    };
  }, [router]);

  useEffect(() => {
    if (emailCooldown <= 0) return;
    const timer = window.setTimeout(() => setEmailCooldown((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [emailCooldown]);

  async function handleSendEmailCode() {
    setError("");
    setSuccess("");
    if (!email.trim()) {
      setError("请先输入邮箱。");
      return;
    }
    setEmailSending(true);
    try {
      const result = await sendEmailCode(email.trim(), "register");
      setSuccess(result.message || "邮箱验证码已发送。");
      setEmailCooldown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "邮箱验证码发送失败");
    } finally {
      setEmailSending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!captchaId || captchaCode.length !== 4) {
      setError("请输入正确的数字验证码。");
      return;
    }

    if (mode === "register") {
      if (password !== confirmPassword) {
        setError("两次输入的密码不一致。");
        return;
      }
      if (emailCode.length !== 6) {
        setError("请输入 6 位邮箱验证码。");
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await login(email.trim(), password, captchaId, captchaCode);
        setLoginFailures(0);
        setSuccess("登录成功，正在进入工作台");
      } else {
        await register(email.trim(), password, name.trim() || undefined, captchaId, captchaCode, emailCode);
        setSuccess("注册成功，正在进入工作台");
      }
      setCaptchaCode("");
      setEmailCode("");
      router.push(nextPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : "认证失败，请稍后重试";
      setError(message);
      const nextFailures = mode === "login" ? loginFailures + 1 : loginFailures;
      setLoginFailures(nextFailures);
      if (message.includes("验证码") || nextFailures >= 3) {
        void refreshCaptcha();
      }
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setEmailCode("");
    void refreshCaptcha();
  }

  return (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F5F7]">
      <section className="mx-auto grid max-w-desktop grid-cols-1 gap-8 px-6 py-10 lg:grid-cols-[0.9fr_1.1fr] lg:py-16">
        <div className="flex flex-col justify-center">
          <div className="mb-8 inline-flex w-fit items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-[14px] font-medium text-[#1D1D1F] shadow-sm">
            <BrandLogo className="h-5 w-5" />
            {BRAND_NAME} 设计工作台
          </div>

          <div className="rounded-[24px] border border-black/5 bg-white p-6 shadow-card-hover sm:p-8">
            <div className="mb-6">
              <p className="mb-2 text-[14px] font-medium text-[#86868B]">你的 AI 商业视觉助手</p>
              <h1 className="text-[34px] font-semibold leading-tight tracking-normal text-[#1D1D1F] sm:text-[44px]">
                登录后继续生成、编辑和沉淀你的品牌作品
              </h1>
            </div>

            <div className="mb-6 grid grid-cols-2 rounded-[14px] bg-[#F5F5F7] p-1">
              <button
                type="button"
                onClick={() => switchMode("login")}
                className={`h-10 rounded-[11px] text-[15px] font-medium transition-all ${
                  mode === "login" ? "bg-white text-[#007AFF] shadow-sm" : "text-[#86868B]"
                }`}
              >
                登录
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={`h-10 rounded-[11px] text-[15px] font-medium transition-all ${
                  mode === "register" ? "bg-white text-[#007AFF] shadow-sm" : "text-[#86868B]"
                }`}
              >
                注册
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "register" && (
                <label className="block text-[14px] font-medium text-[#1D1D1F]">
                  昵称
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={BRAND_STUDIO_NAME}
                    autoComplete="name"
                    className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
                  />
                </label>
              )}

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

              <label className="block text-[14px] font-medium text-[#1D1D1F]">
                密码
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 8 位"
                  minLength={8}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
                />
              </label>

              {mode === "register" && (
                <label className="block text-[14px] font-medium text-[#1D1D1F]">
                  确认密码
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="再次输入密码"
                    minLength={8}
                    autoComplete="new-password"
                    required
                    className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
                  />
                </label>
              )}

              <div className="grid grid-cols-[1fr_auto] gap-3">
                <label className="block text-[14px] font-medium text-[#1D1D1F]">
                  数字验证码
                  <input
                    value={captchaCode}
                    onChange={(event) => setCaptchaCode(onlyDigits(event.target.value, 4))}
                    inputMode="numeric"
                    placeholder="4 位数字"
                    required
                    className="mt-2 h-12 w-full rounded-[12px] border border-[#D1D1D6] bg-white px-4 text-[15px] outline-none transition focus:border-[#007AFF] focus:shadow-[0_0_0_3px_rgba(0,122,255,0.15)]"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void refreshCaptcha()}
                  className="mt-7 flex h-12 w-[142px] items-center justify-center gap-2 overflow-hidden rounded-[12px] border border-[#D1D1D6] bg-[#F8FAFC] px-2 text-[13px] font-semibold text-[#475569] transition hover:border-[#007AFF]/40"
                >
                  {captchaImage ? <img src={captchaImage} alt="数字验证码" className="h-10 w-[96px]" /> : "刷新"}
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>

              {mode === "register" && (
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
                    onClick={() => void handleSendEmailCode()}
                    disabled={emailSending || emailCooldown > 0}
                    className="mt-7 h-12 w-[142px] rounded-[12px] border border-[#007AFF]/25 bg-[#EFF6FF] px-3 text-[13px] font-semibold text-[#007AFF] transition hover:bg-[#E5F2FF] disabled:cursor-not-allowed disabled:opacity-55"
                  >
                    {emailSending ? "发送中..." : emailCooldown > 0 ? `${emailCooldown} 秒后重发` : "获取邮箱验证码"}
                  </button>
                </div>
              )}

              {error && (
                <div className="rounded-[12px] border border-[#FF3B30]/20 bg-[#FF3B30]/5 px-4 py-3 text-[14px] text-[#B42318]">
                  {error}
                </div>
              )}
              {success && (
                <div className="rounded-[12px] border border-[#30D158]/20 bg-[#30D158]/10 px-4 py-3 text-[14px] text-[#1D7A35]">
                  {success}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-[12px] bg-[#007AFF] text-[15px] font-semibold text-white transition hover:bg-[#0067D8] active:scale-[0.98] disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {submitLabel}
                {!loading ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
            </form>
            {mode === "login" && (
              <div className="mt-4 text-center">
                <a
                  href="/forgot-password"
                  className="text-[14px] font-medium text-[#007AFF] no-underline hover:text-[#0067D8]"
                >
                  忘记密码？
                </a>
              </div>
            )}
          </div>
        </div>

        <div className="relative overflow-hidden rounded-[28px] border border-black/5 bg-[#111113] p-4 text-white shadow-card-hover sm:p-6">
          <div className="relative rounded-[22px] border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-[13px] text-white/55">新对话</p>
                <h2 className="text-[22px] font-semibold">为咖啡品牌设计朋友圈首发图</h2>
              </div>
              <span className="rounded-full bg-white px-3 py-1 text-[12px] font-medium text-[#1D1D1F]">
                1080 x 1080
              </span>
            </div>

            <div className="mb-5 rounded-[18px] bg-white p-4 text-[#1D1D1F]">
              <p className="text-[15px] leading-relaxed">
                为一家新开业精品咖啡店生成朋友圈九宫格，包括主视觉、菜单卡片和开业优惠图。
              </p>
            </div>

            <div className="space-y-3">
              {previewSteps.map((step) => (
                <div key={step} className="flex items-center justify-between rounded-[14px] border border-white/10 bg-white/[0.06] px-4 py-3">
                  <span className="text-[14px] text-white/80">{step}</span>
                  <span className="inline-flex items-center gap-1 text-[13px] text-[#30D158]">
                    <CheckCircle2 className="h-4 w-4" /> 已完成
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 gap-3">
              {previewCards.map((card) => (
                <div key={card.title} className="overflow-hidden rounded-[16px] bg-white p-2">
                  <div className={`aspect-square rounded-[12px] ${card.tone}`} />
                  <p className="mt-2 truncate text-[12px] font-medium text-[#1D1D1F]">{card.title}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-[18px] border border-white/10 bg-white/[0.06] p-4">
              <div className="mb-3 flex items-center justify-between text-[13px] text-white/60">
                <span>画布图层</span>
                <span>v1</span>
              </div>
              <div className="space-y-2">
                {["品牌主图", "开业标题", "价格标签"].map((layer) => (
                  <div key={layer} className="rounded-[10px] bg-white/10 px-3 py-2 text-[13px] text-white/80">
                    {layer}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
