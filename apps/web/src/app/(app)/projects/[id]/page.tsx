"use client";

import { useSession } from "next-auth/react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PlanDocument } from "@just-plan/plan-schema";
import { emptyPlan } from "@just-plan/plan-schema";
import { api } from "@/lib/api";
import { PlanCanvasDynamic } from "@/components/plan-canvas-dynamic";
import { ChatPanel, type ChatItem } from "@/components/chat-panel";

export default function ProjectWorkspacePage() {
  const params = useParams<{ id: string }>();
  const projectId = params.id;
  const { data: session } = useSession();
  const token = session?.apiToken;

  const [name, setName] = useState("Проект");
  const [plan, setPlan] = useState<PlanDocument>(emptyPlan());
  const [underlayUrl, setUnderlayUrl] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [chatBusy, setChatBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const reload = useCallback(async () => {
    if (!token) return;
    const data = await api.getProject(token, projectId);
    setName(data.project.name);
    setPlan(data.plan);
    setUnderlayUrl(data.project.thumbnailUrl ?? null);
    setDirty(false);
    const history = await api.chatHistory(token, projectId);
    setMessages(history);
  }, [token, projectId]);

  useEffect(() => {
    if (!token) return;
    reload().catch((err: Error) => setError(err.message));
  }, [token, reload]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function onUpload(file: File) {
    if (!token) return;
    setError(null);
    setJobStatus("queued");
    try {
      const { asset, job } = await api.upload(token, projectId, file);
      setUnderlayUrl(asset.url);
      setJobStatus(job.status);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        const j = await api.getJob(token, job.id);
        setJobStatus(`${j.status} ${j.progress}%`);
        if (j.status === "completed") {
          if (pollRef.current) clearInterval(pollRef.current);
          await reload();
          setJobStatus("completed");
        }
        if (j.status === "failed") {
          if (pollRef.current) clearInterval(pollRef.current);
          setError(j.error ?? "Vectorization failed");
          setJobStatus("failed");
        }
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setJobStatus(null);
    }
  }

  async function onUndo() {
    if (!token) return;
    const data = await api.undo(token, projectId);
    setPlan(data.plan);
    setDirty(false);
  }

  async function onSaveManual() {
    if (!token || !dirty) return;
    const data = await api.commitPlan(token, projectId, plan);
    setPlan(data.plan);
    setDirty(false);
  }

  async function onSend(message: string) {
    if (!token) return;
    setChatBusy(true);
    setMessages((prev) => [
      ...prev,
      { id: `local-${Date.now()}`, role: "user", content: message },
    ]);
    try {
      const res = await api.chat(token, projectId, message);
      setPlan(res.plan);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: "assistant",
          content: res.message.content,
        },
      ]);
      setDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chat failed");
    } finally {
      setChatBusy(false);
    }
  }

  if (!session) {
    return <main className="p-8 text-ink/60">Загрузка workspace…</main>;
  }

  return (
    <div className="flex h-[100dvh] flex-col">
      <header className="flex items-center gap-3 border-b border-moss/15 bg-[#f7f2e8]/90 px-4 py-3 backdrop-blur">
        <Link
          href="/dashboard"
          prefetch
          className="text-sm text-moss hover:underline"
        >
          ← Проекты
        </Link>
        <h1 className="font-display text-xl text-ink">{name}</h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {jobStatus ? (
            <span className="text-xs text-ink/55">Job: {jobStatus}</span>
          ) : null}
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-full border border-ink/10 bg-white/70 px-3 py-1.5 text-sm"
          >
            Загрузить JPG
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,.jpg,.jpeg,.png"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void onUpload(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => void onUndo()}
            className="rounded-full border border-ink/10 bg-white/70 px-3 py-1.5 text-sm"
          >
            Undo
          </button>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => void onSaveManual()}
            className="rounded-full bg-moss px-3 py-1.5 text-sm text-paper disabled:opacity-40"
          >
            Сохранить
          </button>
        </div>
      </header>

      {error ? (
        <div className="bg-clay/15 px-4 py-2 text-sm text-clay">{error}</div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_340px]">
        <PlanCanvasDynamic
          plan={plan}
          underlayUrl={underlayUrl}
          onPlanChange={(next) => {
            setPlan(next);
            setDirty(true);
          }}
        />
        <ChatPanel messages={messages} busy={chatBusy} onSend={onSend} />
      </div>
    </div>
  );
}
