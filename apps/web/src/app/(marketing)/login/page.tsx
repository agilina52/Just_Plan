"use client";

import { signIn, useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  async function softDevLogin() {
    setBusy("dev-login");
    setError(null);
    try {
      const result = await signIn("dev-login", {
        redirect: false,
        callbackUrl: "/dashboard",
      });
      if (result?.error) {
        setError(result.error);
        return;
      }
      router.replace("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(null);
    }
  }

  function oauthLogin(provider: "google" | "yandex" | "mailru") {
    // OAuth providers require a full redirect to the identity provider.
    setBusy(provider);
    void signIn(provider, { callbackUrl: "/dashboard" });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-6 py-16">
      <Link href="/" prefetch className="font-display text-3xl text-moss">
        Just Plan
      </Link>
      <h1 className="mt-8 font-display text-4xl text-ink">Вход</h1>
      <p className="mt-3 text-ink/70">
        Войдите через имеющуюся учётную запись. Dev Login работает без полной
        перезагрузки страницы.
      </p>

      <div className="mt-10 flex flex-col gap-3">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => oauthLogin("google")}
          className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-left text-sm hover:bg-white disabled:opacity-60"
        >
          Продолжить с Google
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => oauthLogin("yandex")}
          className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-left text-sm hover:bg-white disabled:opacity-60"
        >
          Продолжить с Яндекс
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => oauthLogin("mailru")}
          className="rounded-full border border-ink/10 bg-white/70 px-5 py-3 text-left text-sm hover:bg-white disabled:opacity-60"
        >
          Продолжить с Mail.ru
        </button>
        <button
          type="button"
          disabled={!!busy}
          onClick={() => void softDevLogin()}
          className="rounded-full bg-moss px-5 py-3 text-left text-sm font-medium text-paper hover:bg-moss/90 disabled:opacity-60"
        >
          {busy === "dev-login" ? "Входим…" : "Dev Login (локально)"}
        </button>
      </div>
      {error ? <p className="mt-4 text-sm text-clay">{error}</p> : null}
    </main>
  );
}
