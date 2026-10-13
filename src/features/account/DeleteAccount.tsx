"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import type { Dictionary } from "@/i18n/dictionaries/it";

type Texts = Dictionary["account"];

// The user must type the account email: a deliberate step, and the same check the server makes.
export function DeleteAccount({ email, locale, texts }: { email: string; locale: string; texts: Texts }) {
  const router = useRouter();
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === email.toLowerCase();

  async function remove(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!matches) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmEmail: typed }),
      });
      if (response.ok) {
        // The session row is gone with the account: the home page shows the signed-out view.
        router.push(`/${locale}`);
        router.refresh();
        return;
      }
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      setError((data.error && (texts.errors as Record<string, string>)[data.error]) || texts.errors.GENERIC);
    } catch {
      setError(texts.errors.GENERIC);
    }
    setPending(false);
  }

  return (
    <form onSubmit={remove} className="space-y-3">
      <div className="space-y-1">
        <label htmlFor="confirm-email" className="block text-sm text-zinc-300">
          {texts.confirmLabel}
        </label>
        <input
          id="confirm-email"
          type="email"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder={email}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <button
        type="submit"
        disabled={!matches || pending}
        className="rounded-full bg-red-700 px-5 py-2 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-50"
      >
        {pending ? texts.deleting : texts.deleteCta}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </form>
  );
}
