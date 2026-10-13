"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { format } from "@/i18n";
import type { Dictionary } from "@/i18n/dictionaries/it";

type Texts = Dictionary["admin"]["detail"];
type ErrorTexts = Dictionary["admin"]["errors"];

type Props = {
  userId: string;
  blocked: boolean;
  isSelf: boolean;
  texts: Texts;
  errors: ErrorTexts;
};

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500";

// Block switch and credit adjustment. Both go through the admin API, which checks the role again.
export function UserActions({ userId, blocked, isSelf, texts, errors }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");

  async function send(path: string, method: string, body: unknown) {
    const response = await fetch(path, {
      method,
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await response.json().catch(() => ({}))) as { error?: string; balance?: number };
    return { ok: response.ok, data };
  }

  function errorText(code: string | undefined) {
    return (code && (errors as Record<string, string>)[code]) || errors.GENERIC;
  }

  async function toggleBlocked() {
    setPending(true);
    setMessage(null);
    try {
      const { ok, data } = await send(`/api/admin/users/${userId}`, "PATCH", { blocked: !blocked });
      if (ok) {
        setMessage({ tone: "ok", text: texts.blockDone });
        router.refresh();
      } else {
        setMessage({ tone: "error", text: errorText(data.error) });
      }
    } catch {
      setMessage({ tone: "error", text: errors.GENERIC });
    }
    setPending(false);
  }

  async function adjust(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(amount);
    if (!Number.isInteger(value) || value === 0 || note.trim().length < 3) {
      setMessage({ tone: "error", text: errors.VALIDATION });
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const { ok, data } = await send(`/api/admin/users/${userId}/credits`, "POST", { amount: value, note });
      if (ok) {
        setMessage({ tone: "ok", text: format(texts.adjustDone, { count: data.balance ?? 0 }) });
        setAmount("");
        setNote("");
        router.refresh();
      } else {
        setMessage({ tone: "error", text: errorText(data.error) });
      }
    } catch {
      setMessage({ tone: "error", text: errors.GENERIC });
    }
    setPending(false);
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <p className="text-sm text-zinc-400">{texts.blockHint}</p>
        <button
          type="button"
          onClick={toggleBlocked}
          disabled={pending || isSelf}
          className="rounded-full border border-zinc-600 px-5 py-2 text-sm hover:bg-zinc-900 disabled:opacity-50"
        >
          {blocked ? texts.unblock : texts.block}
        </button>
        {isSelf && <p className="text-sm text-zinc-400">{errors.CANNOT_BLOCK_SELF}</p>}
      </section>

      <form onSubmit={adjust} className="space-y-3 rounded-2xl border border-zinc-800 p-4">
        <h2 className="font-semibold">{texts.adjustTitle}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="adjust-amount" className="block text-sm text-zinc-300">
              {texts.adjustAmount}
            </label>
            <input
              id="adjust-amount"
              type="number"
              step={1}
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              className={inputClass}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="adjust-note" className="block text-sm text-zinc-300">
              {texts.adjustNote}
            </label>
            <input
              id="adjust-note"
              type="text"
              maxLength={200}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-violet-600 px-5 py-2 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {pending ? texts.saving : texts.adjustSubmit}
        </button>
      </form>

      {message && (
        <p
          role={message.tone === "error" ? "alert" : "status"}
          className={message.tone === "error" ? "text-sm text-red-300" : "text-sm text-emerald-200"}
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
