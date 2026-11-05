"use client";

import { useState, useTransition } from "react";
import { setQuizOpen } from "@/app/admin/actions";

export function OpenToggle({ quizId, isOpen }: { quizId: string; isOpen: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex items-center gap-3">
      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${isOpen ? "bg-emerald-100 text-emerald-800" : "bg-stone-200 text-stone-700"}`}
      >
        {isOpen ? "Open for responses" : "Closed"}
      </span>
      <button
        className={isOpen ? "btn-secondary" : "btn-primary"}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await setQuizOpen(quizId, !isOpen);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? "Saving…" : isOpen ? "Close survey" : "Open survey"}
      </button>
      {error && <span className="text-sm text-red-700">{error}</span>}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3">
      <p className="font-mono text-xs break-all text-stone-600">{url}</p>
      <button
        className="btn-secondary mt-2 w-full"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}
