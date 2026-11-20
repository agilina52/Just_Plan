"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Client-side auth guard with soft client navigation (no full document reload). */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status === "loading") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-ink/60">
        Загрузка…
      </main>
    );
  }

  if (status !== "authenticated") {
    return (
      <main className="flex min-h-[50vh] items-center justify-center text-ink/60">
        Переход ко входу…
      </main>
    );
  }

  return <>{children}</>;
}
