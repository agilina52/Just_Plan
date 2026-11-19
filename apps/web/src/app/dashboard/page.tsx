"use client";

import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { api, type Project } from "@/lib/api";

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const token = session?.apiToken;

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    api
      .listProjects(token)
      .then(setProjects)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, [token]);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    if (!token || !name.trim()) return;
    setError(null);
    try {
      const project = await api.createProject(token, name.trim());
      router.push(`/projects/${project.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create");
    }
  }

  if (status === "loading" || !session) {
    return <main className="p-8 text-ink/60">Загрузка…</main>;
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <Link href="/" className="font-display text-2xl text-moss">
            Just Plan
          </Link>
          <p className="mt-1 text-sm text-ink/60">{session.user?.email}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-ink/60 underline-offset-2 hover:underline"
        >
          Выйти
        </button>
      </header>

      <section className="mt-12">
        <h1 className="font-display text-4xl text-ink">Проекты</h1>
        <form onSubmit={onCreate} className="mt-6 flex flex-wrap gap-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Название нового проекта"
            className="min-w-[240px] flex-1 rounded-full border border-ink/10 bg-white/70 px-4 py-3 text-sm outline-none ring-moss focus:ring-2"
          />
          <button
            type="submit"
            className="rounded-full bg-moss px-5 py-3 text-sm font-medium text-paper"
          >
            Создать
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-clay">{error}</p> : null}
      </section>

      <section className="mt-10">
        {loading ? (
          <p className="text-ink/50">Загрузка проектов…</p>
        ) : projects.length === 0 ? (
          <p className="text-ink/50">Пока нет проектов — создайте первый.</p>
        ) : (
          <ul className="divide-y divide-moss/15 border-t border-moss/15">
            {projects.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between py-4 transition hover:bg-white/40"
                >
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className="text-xs text-ink/45">
                    {new Date(p.updatedAt).toLocaleString("ru-RU")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
