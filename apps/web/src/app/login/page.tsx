"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <Link href="/" className="font-display text-3xl text-moss">
        Just Plan
      </Link>
      <h1 className="mt-8 font-display text-4xl text-ink">Вход</h1>
      <p className="mt-3 text-ink/70">
        Войдите через имеющуюся учётную запись. Для локальной разработки доступен
        Dev Login без OAuth-ключей.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          onClick={() => signIn("google", { callbackUrl: "/dashboard" })}
          className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-left text-sm hover:bg-white"
        >
          Продолжить с Google
        </button>
        <button
          type="button"
          onClick={() => signIn("yandex", { callbackUrl: "/dashboard" })}
          className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-left text-sm hover:bg-white"
        >
          Продолжить с Яндекс
        </button>
        <button
          type="button"
          onClick={() => signIn("mailru", { callbackUrl: "/dashboard" })}
          className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-left text-sm hover:bg-white"
        >
          Продолжить с Mail.ru
        </button>
        <button
          type="button"
          onClick={() => signIn("dev-login", { callbackUrl: "/dashboard" })}
          className="rounded-full bg-moss px-5 py-3 text-left text-sm font-medium text-paper hover:bg-moss/90"
        >
          Dev Login (локально)
        </button>
      </div>
    </main>
  );
}
