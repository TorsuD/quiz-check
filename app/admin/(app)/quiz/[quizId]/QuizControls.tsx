"use client";

import { useState, useTransition } from "react";
import { setQuizOpen } from "@/app/admin/actions";

export function OpenToggle({ quizId, isOpen }: { quizId: string; isOpen: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-3">
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
      {error && <span className="text-sm text-rose-700">{error}</span>}
    </div>
  );
}

export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mt-3 flex items-center gap-2">
      <p className="min-w-0 flex-1 truncate text-left font-mono text-xs text-stone-500" title={url}>
        {url.replace(/^https?:\/\//, "")}
      </p>
      <button
        className="btn-secondary shrink-0 px-2.5 py-1 text-xs"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
