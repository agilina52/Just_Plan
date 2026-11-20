"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function HomePage() {
  const { status } = useSession();
  const enterHref = status === "authenticated" ? "/dashboard" : "/login";

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%232f5d50' fill-opacity='0.06'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <Link href="/" className="font-display text-2xl tracking-tight text-moss">
          Just Plan
        </Link>
        <Link
          href={enterHref}
          prefetch
          className="rounded-full border border-moss/30 bg-white/50 px-4 py-2 text-sm text-ink backdrop-blur transition hover:bg-white"
        >
          {status === "authenticated" ? "К проектам" : "Войти"}
        </Link>
      </header>

      <section className="relative z-10 mx-auto flex min-h-[75vh] w-full max-w-6xl flex-col justify-center px-6 pb-20 pt-8">
        <p className="font-display text-5xl leading-[0.95] tracking-tight text-ink md:max-w-3xl md:text-7xl">
          Just Plan
        </p>
        <h1 className="mt-6 max-w-xl text-lg text-ink/80 md:text-xl">
          Загрузите JPG плана помещения — получите редактируемые линии стен и
          правьте планировку через AI-агента.
        </h1>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link
            href={enterHref}
            prefetch
            className="rounded-full bg-moss px-6 py-3 text-sm font-medium text-paper transition hover:bg-moss/90"
          >
            Начать работу
          </Link>
          <button
            type="button"
            onClick={() =>
              document.getElementById("how")?.scrollIntoView({ behavior: "smooth" })
            }
            className="rounded-full border border-ink/15 bg-white/40 px-6 py-3 text-sm text-ink/80 backdrop-blur"
          >
            Как это работает
          </button>
        </div>
      </section>

      <section id="how" className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-24">
        <h2 className="font-display text-3xl text-ink">Один цикл работы</h2>
        <p className="mt-3 max-w-2xl text-ink/70">
          OAuth → проект → загрузка плана → векторизация → чат с агентом и ручные
          правки линий на canvas.
        </p>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ["1. Вход", "Google, Яндекс или Mail.ru — без отдельного пароля."],
            ["2. Векторизация", "JPG превращается в стены и проёмы как scene graph."],
            ["3. AI-правки", "Промпт меняет JSON плана, canvas обновляется сразу."],
          ].map(([title, text]) => (
            <li key={title} className="border-t border-moss/20 pt-4">
              <p className="font-display text-xl text-moss">{title}</p>
              <p className="mt-2 text-sm text-ink/70">{text}</p>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
