"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Menu, X, UserRound } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { isAuthenticated, logout } from "@/lib/openai-proxy";

const navLinks = [
  { href: "/studio", label: "创作工作室" },
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
    setAuthed(isAuthenticated());
    setOpen(false);
  }, [pathname]);

  const startHref = authed ? "/studio" : "/login?next=/studio";
  const accountHref = authed ? "/settings" : "/login?mode=register&next=/studio";

  const handleLogout = () => {
    logout();
    setAuthed(false);
    setOpen(false);
    router.push("/login");
  };

  if (pathname === "/editor") {
    return null;
  }

  return (
    <header className="glass sticky top-0 z-50">
      <nav className="max-w-desktop mx-auto flex items-center justify-between px-6 h-16">
        <Link href="/" prefetch={false} className="flex items-center gap-2 text-h3 text-[#0F172A] no-underline">
          <BrandLogo className="h-7 w-7" />
          <span className="font-semibold">Drmine AI</span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
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
                onClick={handleLogout}
                className="text-[15px] font-medium text-text-secondary transition-colors hover:text-text-primary"
              >
                退出
              </button>
              <Link
                href={accountHref}
                prefetch={false}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef5ff] text-brand-primary no-underline transition hover:bg-brand-primary hover:text-white"
                aria-label="账号设置"
                title="账号设置"
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
                className="bg-brand-primary text-white px-5 py-2 rounded-apple text-[15px] font-medium hover:scale-[1.02] hover:shadow-card transition-all duration-200 no-underline"
              >
                开始创作
              </Link>
              <Link
                href={accountHref}
                prefetch={false}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[#eef5ff] text-brand-primary no-underline transition hover:bg-brand-primary hover:text-white"
                aria-label="注册账号"
                title="注册账号"
              >
                <UserRound className="h-5 w-5" />
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2 rounded-apple hover:bg-black/5 transition-colors"
          onClick={() => setOpen(!open)}
          aria-label="菜单"
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden glass px-6 pb-6 space-y-3 animate-fade-in-up">
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
                className="block w-full text-center bg-[#eef5ff] text-brand-primary py-3 rounded-apple text-[15px] font-medium no-underline"
                onClick={() => setOpen(false)}
              >
                账号设置
              </Link>
              <button
                onClick={handleLogout}
                className="block w-full py-3 text-center text-[15px] font-medium text-text-secondary"
              >
                退出
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
                className="block w-full text-center bg-brand-primary text-white py-3 rounded-apple text-[15px] font-medium no-underline"
                onClick={() => setOpen(false)}
              >
                开始创作
              </Link>
              <Link
                href={accountHref}
                prefetch={false}
                className="block w-full text-center bg-[#eef5ff] text-brand-primary py-3 rounded-apple text-[15px] font-medium no-underline"
                onClick={() => setOpen(false)}
              >
                注册账号
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}
