"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "I sell handmade candles in Barbados. Save that to my profile.",
  "I made 100 candles. Materials cost $300, jars $0.50 each, and my time $200. What should I charge?",
  "Write an Instagram caption for my new lavender candle.",
  "Plan a Mother's Day promotion for me.",
  "Who is my ideal customer?",
];

export function AssistantChat({ initial, aiConfigured, businessName }: { initial: Message[]; aiConfigured: boolean; businessName: string | null }) {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initial);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<{ message: string; retry: string } | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const localId = useRef(0);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;
    setPending(true);
    setError(null);
    setNote(null);
    setInput("");
    const optimistic: Message = { id: `local-${++localId.current}`, role: "user", content: message };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessages((m) => m.filter((x) => x.id !== optimistic.id));
        setError({ message: data.error ?? `Request failed (${res.status}).`, retry: message });
        setInput(message);
        return;
      }
      setMessages((m) => [...m, { id: `local-${++localId.current}`, role: "assistant", content: data.reply }]);
      if (data.profileUpdated) {
        setNote("Your business profile was updated — every MarketMate tool will use it.");
        router.refresh();
      }
      if (data.saveError) setNote(data.saveError);
    } catch {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setError({ message: "Network error — check your connection and try again.", retry: message });
      setInput(message);
    } finally {
      setPending(false);
    }
  }

  async function clear() {
    if (!confirm("Clear the whole conversation? Your business profile is kept.")) return;
    const res = await fetch("/api/assistant", { method: "DELETE" });
    if (res.ok) {
      setMessages([]);
      setError(null);
    } else {
      setError({ message: "Couldn't clear the conversation.", retry: "" });
    }
  }

  return (
    <div className="card flex h-[calc(100dvh-13rem)] min-h-[480px] flex-col p-0">
      <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <p className="text-sm text-muted">{businessName ? <>Working for <span className="font-medium text-foreground">{businessName}</span></> : "No business profile yet — tell me about your business."}</p>
        {messages.length > 0 && <button type="button" className="text-sm text-muted hover:text-red-600" onClick={() => void clear()}>Clear chat</button>}
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && (
          <div className="mx-auto max-w-xl space-y-4 py-6 text-center">
            <p className="text-lg font-semibold">How can your marketing department help today?</p>
            <p className="text-sm text-muted">I know your business profile, use MarketMate&apos;s calculator for pricing, and can save details you tell me.</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="rounded-full border border-border px-3 py-1.5 text-left text-sm hover:border-brand hover:text-brand disabled:opacity-50" disabled={!aiConfigured || pending} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${m.role === "user" ? "bg-brand text-brand-foreground" : "border border-border bg-background"}`}>
              {m.content}
              {m.role === "assistant" && (
                <button type="button" className="mt-2 block text-xs text-muted hover:text-brand" onClick={() => void navigator.clipboard.writeText(m.content)}>Copy</button>
              )}
            </div>
          </div>
        ))}
        {pending && (
          <div className="flex justify-start">
            <div className="animate-pulse rounded-2xl border border-border bg-background px-4 py-2.5 text-sm text-muted">Thinking…</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="space-y-2 border-t border-border p-3">
        {error && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm text-red-800" role="alert">
            <span>{error.message}</span>
            {error.retry && <button type="button" className="btn-secondary py-1" onClick={() => void send(error.retry)}>Retry</button>}
          </div>
        )}
        {note && <p className="text-sm text-green-700" role="status">{note}</p>}
        {!aiConfigured && <p className="text-sm text-amber-800">AI is not connected: set <code>ANTHROPIC_API_KEY</code> on the server.</p>}
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(input);
          }}
        >
          <label htmlFor="assistant-input" className="sr-only">Message</label>
          <textarea
            id="assistant-input"
            className="input max-h-40 min-h-11 flex-1 resize-y"
            rows={1}
            maxLength={4000}
            placeholder="Ask about pricing, captions, promotions, personas…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            disabled={!aiConfigured}
          />
          <button className="btn-primary" disabled={pending || !input.trim() || !aiConfigured}>Send</button>
        </form>
      </div>
    </div>
  );
}
