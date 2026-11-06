import type { ReactNode } from "react";

/** Page title row used across admin pages. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-2 text-sm">{eyebrow}</div>}
        <h1 className="text-3xl text-ink sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

const TONES = {
  brand: "bg-brand-200 text-ink",
  emerald: "bg-emerald-200 text-ink",
  violet: "bg-violet-200 text-ink",
  amber: "bg-yellow-300 text-ink",
  rose: "bg-rose-200 text-ink",
} as const;
export type Tone = keyof typeof TONES;

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "brand",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
}) {
  return (
    <div className="card flex items-start gap-4">
      {icon && <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border-2 border-line text-lg ${TONES[tone]}`}>{icon}</span>}
      <div className="min-w-0">
        <p className="text-xs font-semibold tracking-wider text-stone-500 uppercase">{label}</p>
        <p className="mt-0.5 font-display text-3xl text-ink tabular-nums">{value}</p>
        {hint && <p className="mt-0.5 text-xs text-stone-500">{hint}</p>}
      </div>
    </div>
  );
}

export function IconTile({ icon, tone = "brand" }: { icon: ReactNode; tone?: Tone }) {
  return <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border-2 border-line text-lg ${TONES[tone]}`}>{icon}</span>;
}

export type SurveyStatus = "draft" | "open" | "closed";

export function StatusPill({ status }: { status: SurveyStatus }) {
  const styles: Record<SurveyStatus, string> = {
    draft: "bg-amber-50 text-amber-700",
    open: "bg-emerald-50 text-emerald-700",
    closed: "bg-stone-100 text-stone-600",
  };
  const labels: Record<SurveyStatus, string> = { draft: "Draft", open: "Open", closed: "Closed" };
  return (
    <span className={`pill ${styles[status]}`}>
      <span
        className={`h-1.5 w-1.5 rounded-none ${status === "open" ? "animate-pulse bg-emerald-500" : status === "draft" ? "bg-amber-500" : "bg-stone-400"}`}
      />
      {labels[status]}
    </span>
  );
}

export function DifficultyPill({ level }: { level: "easy" | "medium" | "hard" }) {
  const styles = {
    easy: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    hard: "bg-rose-50 text-rose-700",
  };
  return <span className={`pill capitalize ${styles[level]}`}>{level}</span>;
}

export function LoadingCard({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="card mt-6 flex items-center gap-3 text-stone-500">
      <span className="h-4 w-4 animate-spin border-2 border-line border-t-yellow-400" />
      {label}
    </div>
  );
}
