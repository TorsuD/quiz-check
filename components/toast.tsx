"use client";

import { useSyncExternalStore } from "react";
import { AlertIcon, CheckIcon, XIcon } from "@/components/icons";

/*
 * Tiny toast system. Call toast("Saved") or toast.error("Could not save") from any client component;
 * <Toaster /> (mounted once in a layout) renders them. No provider needed: the queue is a module-level store.
 */

type Tone = "success" | "error" | "info";
type Toast = { id: number; message: string; tone: Tone };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function dismiss(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

function push(message: string, tone: Tone) {
  const id = nextId++;
  toasts = [...toasts.slice(-3), { id, message, tone }]; // keep at most 4 on screen
  emit();
  setTimeout(() => dismiss(id), tone === "error" ? 7000 : 3500);
}

export const toast = Object.assign((message: string) => push(message, "success"), {
  error: (message: string) => push(message, "error"),
  info: (message: string) => push(message, "info"),
});

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const EMPTY: Toast[] = [];

export function Toaster() {
  const list = useSyncExternalStore(subscribe, () => toasts, () => EMPTY);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:items-end"
    >
      {list.map((t) => (
        <div
          key={t.id}
          role={t.tone === "error" ? "alert" : "status"}
          className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-md border-2 border-line px-3.5 py-2.5 text-sm text-ink shadow-md ${
            t.tone === "error" ? "bg-rose-100" : t.tone === "success" ? "bg-emerald-100" : "bg-surface"
          }`}
        >
          <span className={`mt-0.5 shrink-0 ${t.tone === "error" ? "text-rose-700" : "text-emerald-700"}`}>
            {t.tone === "error" ? <AlertIcon /> : <CheckIcon strokeWidth={3} />}
          </span>
          <p className="min-w-0 flex-1">{t.message}</p>
          <button type="button" onClick={() => dismiss(t.id)} aria-label="Dismiss" className="shrink-0 text-stone-500 hover:text-ink">
            <XIcon />
          </button>
        </div>
      ))}
    </div>
  );
}
