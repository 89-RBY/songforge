import type { ReactNode } from "react";

export const inputClass =
  "w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-50 placeholder:text-zinc-500 focus:border-violet-400 focus:outline-none";

export function StepTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-2xl font-bold tracking-tight">{children}</h2>;
}

export function OptionCard({
  selected,
  onSelect,
  icon,
  description,
  children,
}: {
  selected: boolean;
  onSelect: () => void;
  icon?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl border p-3 text-center transition ${
        selected
          ? "border-violet-400 bg-violet-500/20 text-white"
          : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {icon && (
        <span aria-hidden="true" className="text-2xl">
          {icon}
        </span>
      )}
      <span className="text-sm font-medium">{children}</span>
      {description && <span className="text-xs text-zinc-400">{description}</span>}
    </button>
  );
}

export function Chip({ selected, onToggle, children }: { selected: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      className={`rounded-full border px-4 py-2 text-sm transition ${
        selected
          ? "border-violet-400 bg-violet-500/20 text-white"
          : "border-zinc-800 bg-zinc-900 text-zinc-300 hover:border-zinc-600"
      }`}
    >
      {children}
    </button>
  );
}
