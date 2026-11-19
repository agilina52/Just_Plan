"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

export type ChatItem = {
  id: string;
  role: string;
  content: string;
};

type Props = {
  messages: ChatItem[];
  busy?: boolean;
  onSend: (message: string) => Promise<void>;
};

export function ChatPanel({ messages, busy, onSend }: Props) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (!value || busy) return;
    setText("");
    await onSend(value);
  }

  return (
    <aside className="flex h-full flex-col border-l border-moss/15 bg-[#f7f2e8]/80 backdrop-blur">
      <div className="border-b border-moss/15 px-4 py-3">
        <p className="font-display text-lg text-moss">AI агент</p>
        <p className="text-xs text-ink/55">
          Правки планировки через tool-calling (стены, проёмы, подписи).
        </p>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (
          <p className="text-sm text-ink/45">
            Примеры: «убери стену для open-space», «пометь как кухня», «добавь
            дверь».
          </p>
        ) : null}
        {messages.map((m) => (
          <div
            key={m.id}
            className={
              m.role === "user"
                ? "ml-6 rounded-2xl bg-moss px-3 py-2 text-sm text-paper"
                : "mr-6 rounded-2xl bg-white/70 px-3 py-2 text-sm text-ink"
            }
          >
            {m.content}
          </div>
        ))}
        {busy ? (
          <p className="text-xs text-ink/45">Агент думает…</p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form onSubmit={submit} className="border-t border-moss/15 p-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          placeholder="Запрос к агенту…"
          className="w-full resize-none rounded-2xl border border-ink/10 bg-white/80 px-3 py-2 text-sm outline-none ring-moss focus:ring-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full rounded-full bg-clay px-4 py-2 text-sm font-medium text-paper disabled:opacity-50"
        >
          Отправить
        </button>
      </form>
    </aside>
  );
}
