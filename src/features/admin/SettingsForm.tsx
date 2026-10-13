"use client";

import { useState, type FormEvent } from "react";
import type { Dictionary } from "@/i18n/dictionaries/it";

type Texts = Dictionary["admin"]["settings"];

export type SettingsFormValues = {
  marginMultiplier: string;
  centsPerCredit: string;
  signupCredits: string;
  dailyCapEuros: string;
  packages: { id: string; credits: string; priceEuros: string }[];
  disabledProviders: string[];
};

type Props = {
  texts: Texts;
  validationText: string;
  genericText: string;
  initial: SettingsFormValues;
  providers: { id: string; label: string }[];
};

const inputClass =
  "w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500";

// Euros are typed by the operator and converted to cents here. Decimal commas are accepted.
function toNumber(value: string): number {
  return Number(value.replace(",", "."));
}

function toCents(value: string): number {
  return Math.round(toNumber(value) * 100);
}

export function SettingsForm({ texts, validationText, genericText, initial, providers }: Props) {
  const [values, setValues] = useState(initial);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  function setField<K extends "marginMultiplier" | "centsPerCredit" | "signupCredits" | "dailyCapEuros">(
    key: K,
    value: string,
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }

  function setPackage(index: number, patch: Partial<SettingsFormValues["packages"][number]>) {
    setValues((current) => ({
      ...current,
      packages: current.packages.map((pkg, i) => (i === index ? { ...pkg, ...patch } : pkg)),
    }));
  }

  function toggleProvider(id: string) {
    setValues((current) => ({
      ...current,
      disabledProviders: current.disabledProviders.includes(id)
        ? current.disabledProviders.filter((item) => item !== id)
        : [...current.disabledProviders, id],
    }));
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const body = {
      marginMultiplier: toNumber(values.marginMultiplier),
      centsPerCredit: toNumber(values.centsPerCredit),
      signupCredits: toNumber(values.signupCredits),
      dailyApiCapCents: toCents(values.dailyCapEuros),
      packages: values.packages.map((pkg) => ({
        id: pkg.id.trim(),
        credits: toNumber(pkg.credits),
        priceCents: toCents(pkg.priceEuros),
      })),
      disabledProviders: values.disabledProviders,
    };
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.ok) {
        setMessage({ tone: "ok", text: texts.saved });
      } else {
        const data = (await response.json().catch(() => ({}))) as { error?: string };
        setMessage({ tone: "error", text: data.error === "VALIDATION" ? validationText : genericText });
      }
    } catch {
      setMessage({ tone: "error", text: genericText });
    }
    setPending(false);
  }

  return (
    <form onSubmit={save} className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <Field id="margin" label={texts.margin}>
          <input id="margin" className={inputClass} inputMode="decimal" value={values.marginMultiplier} onChange={(e) => setField("marginMultiplier", e.target.value)} />
        </Field>
        <Field id="cents" label={texts.centsPerCredit}>
          <input id="cents" className={inputClass} inputMode="numeric" value={values.centsPerCredit} onChange={(e) => setField("centsPerCredit", e.target.value)} />
        </Field>
        <Field id="signup" label={texts.signupCredits}>
          <input id="signup" className={inputClass} inputMode="numeric" value={values.signupCredits} onChange={(e) => setField("signupCredits", e.target.value)} />
        </Field>
        <Field id="cap" label={texts.dailyCap}>
          <input id="cap" className={inputClass} inputMode="decimal" value={values.dailyCapEuros} onChange={(e) => setField("dailyCapEuros", e.target.value)} />
        </Field>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{texts.packages}</h2>
        {values.packages.map((pkg, index) => (
          <fieldset key={pkg.id} className="grid gap-3 rounded-2xl border border-zinc-800 p-4 sm:grid-cols-3">
            <legend className="px-1 text-sm font-medium text-zinc-300">{pkg.id}</legend>
            <Field id={`pkg-${index}-credits`} label={texts.packageCredits}>
              <input id={`pkg-${index}-credits`} className={inputClass} inputMode="numeric" value={pkg.credits} onChange={(e) => setPackage(index, { credits: e.target.value })} />
            </Field>
            <Field id={`pkg-${index}-price`} label={texts.packagePrice}>
              <input id={`pkg-${index}-price`} className={inputClass} inputMode="decimal" value={pkg.priceEuros} onChange={(e) => setPackage(index, { priceEuros: e.target.value })} />
            </Field>
          </fieldset>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold">{texts.providers}</h2>
        {providers.length === 0 && <p className="text-sm text-zinc-400">{texts.noProviders}</p>}
        {providers.map((provider) => (
          <label key={provider.id} className="flex items-center gap-3 text-sm text-zinc-200">
            <input
              type="checkbox"
              checked={values.disabledProviders.includes(provider.id)}
              onChange={() => toggleProvider(provider.id)}
              className="size-4 accent-violet-600"
            />
            {texts.providerDisabled} ({provider.label})
          </label>
        ))}
      </section>

      {message && (
        <p role={message.tone === "error" ? "alert" : "status"} className={message.tone === "error" ? "text-sm text-red-300" : "text-sm text-emerald-200"}>
          {message.text}
        </p>
      )}

      <button type="submit" disabled={pending} className="rounded-full bg-violet-600 px-6 py-2.5 font-medium text-white hover:bg-violet-700 disabled:opacity-50">
        {pending ? texts.saving : texts.save}
      </button>
    </form>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}
