"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, UserRound, X } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { BRAND_NAME } from "@/lib/brand";
import { getSession, logout } from "@/lib/openai-proxy";

const navLinks = [
  { href: "/studio", label: "创作工作台" },
  { href: "/editor", label: "画布编辑" },
  { href: "/templates", label: "模板库" },
  { href: "/gallery", label: "作品库" },
];

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let mounted = true;
    void getSession()
      .then((session) => {
        if (mounted) setAuthed(!!session);
      })
      .catch(() => {
        if (mounted) setAuthed(false);
      });
    setOpen(false);
    return () => {
      mounted = false;
    };
  }, [pathname]);

  const startHref = authed ? "/studio" : "/login?next=/studio";
  const accountHref = authed ? "/settings" : "/login?mode=register&next=/studio";

  const handleLogout = async () => {
    await logout();
    setAuthed(false);
    setOpen(false);
    router.push("/login");
  };

  if (pathname === "/editor") {
    return null;
  }

  return (
    <header className="glass sticky top-0 z-50">
      <nav className="max-w-desktop mx-auto flex h-16 items-center justify-between px-6">
        <Link
          href="/"
          prefetch={false}
          className="flex items-center gap-2 text-h3 text-[#0F172A] no-underline"
        >
          <BrandLogo className="h-7 w-7" />
          <span className="font-semibold">{BRAND_NAME}</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={`text-[15px] transition-colors duration-200 no-underline ${
                  isActive
                    ? "text-brand-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                {link.label}
              </Link>
            );
          })}

          {authed ? (
            <>
              <button
                onClick={() => void handleLogout()}
                className="text-[15px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                退出登录
              </button>
              <Link
                href={accountHref}
                prefetch={false}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF5FF] text-brand-primary no-underline transition hover:bg-brand-primary hover:text-white"
                aria-label="账户设置"
                title="账户设置"
              >
                <UserRound className="h-5 w-5" />
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                prefetch={false}
                className="text-[15px] font-medium text-text-secondary transition-colors no-underline hover:text-text-primary"
              >
                登录
              </Link>
              <Link
                href={startHref}
                prefetch={false}
                className="rounded-apple bg-brand-primary px-5 py-2 text-[15px] font-medium text-white no-underline transition-all duration-200 hover:scale-[1.02] hover:shadow-card"
              >
                开始创作
              </Link>
              <Link
                href={accountHref}
                prefetch={false}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#EEF5FF] text-brand-primary no-underline transition hover:bg-brand-primary hover:text-white"
                aria-label="注册账户"
                title="注册账户"
              >
                <UserRound className="h-5 w-5" />
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-apple p-2 transition-colors hover:bg-black/5 md:hidden"
          onClick={() => setOpen((value) => !value)}
          aria-label="菜单"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {open && (
        <div className="glass animate-fade-in-up space-y-3 px-6 pb-6 md:hidden">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={`block py-2 text-body no-underline ${
                  isActive
                    ? "text-brand-primary font-medium"
                    : "text-text-secondary hover:text-text-primary"
                }`}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            );
          })}

          {authed ? (
            <>
              <Link
                href="/settings"
                prefetch={false}
                className="rounded-apple block w-full bg-[#EEF5FF] py-3 text-center text-[15px] font-medium text-brand-primary no-underline"
                onClick={() => setOpen(false)}
              >
                账户设置
              </Link>
              <button
                onClick={() => void handleLogout()}
                className="block w-full py-3 text-center text-[15px] font-medium text-text-secondary"
              >
                退出登录
              </button>
            </>
          ) : (
            <>
              <Link
                href="/login"
                prefetch={false}
                className="block py-2 text-body text-text-secondary no-underline"
                onClick={() => setOpen(false)}
              >
                登录
              </Link>
              <Link
                href={startHref}
                prefetch={false}
                className="rounded-apple block w-full bg-brand-primary py-3 text-center text-[15px] font-medium text-white no-underline"
                onClick={() => setOpen(false)}
              >
                开始创作
              </Link>
              <Link
                href={accountHref}
                prefetch={false}
                className="rounded-apple block w-full bg-[#EEF5FF] py-3 text-center text-[15px] font-medium text-brand-primary no-underline"
                onClick={() => setOpen(false)}
              >
                注册账户
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
