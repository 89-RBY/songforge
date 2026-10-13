"use client";

import { useState } from "react";

type Props = {
  packageId: string;
  locale: string;
  buy: string;
  buying: string;
  genericError: string;
  errors: Record<string, string>;
};

// Asks the server for a Checkout session and follows it. The price is never sent by the client.
export function BuyButton({ packageId, locale, buy, buying, genericError, errors }: Props) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startCheckout() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageId, locale }),
      });
      const data = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
      if (response.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      setError((data.error && errors[data.error]) || genericError);
    } catch {
      setError(genericError);
    }
    setPending(false);
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={startCheckout}
        disabled={pending}
        className="w-full rounded-full bg-violet-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-50"
      >
        {pending ? buying : buy}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
