"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import clsx from "clsx";

const nav = [
  { href: "/dashboard", label: "Проекты" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const isWorkspace = pathname?.startsWith("/projects/");

  async function onSignOut() {
    await signOut({ redirect: false });
    router.replace("/");
  }

  if (isWorkspace) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-moss/15 bg-[#f7f2e8]/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-6 px-6 py-3">
          <Link href="/dashboard" className="font-display text-xl text-moss">
            Just Plan
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className={clsx(
                  "rounded-full px-3 py-1.5 text-sm transition",
                  pathname === item.href || pathname?.startsWith(`${item.href}/`)
                    ? "bg-moss text-paper"
                    : "text-ink/70 hover:bg-white/60",
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-xs text-ink/50 sm:inline">
              {session?.user?.email}
            </span>
            <button
              type="button"
              onClick={() => void onSignOut()}
              className="text-sm text-ink/60 underline-offset-2 hover:underline"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}
