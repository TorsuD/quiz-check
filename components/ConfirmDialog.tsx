"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Styled replacement for window.confirm, built on the native <dialog> element
 * (focus is trapped inside, Escape and the backdrop close it).
 */
export default function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  tone = "primary",
  pending = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        if (pending) e.preventDefault(); // don't close mid-action
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose(); // click on the backdrop
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-md border-2 border-line bg-surface p-0 text-left text-ink shadow-lg backdrop:bg-ink/40"
    >
      <div className="p-5">
        <h2 id="confirm-title" className="text-xl">
          {title}
        </h2>
        {children && <div className="mt-2 text-sm text-stone-600">{children}</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose} disabled={pending} autoFocus>
            {cancelLabel}
          </button>
          <button type="button" className={tone === "danger" ? "btn-danger" : "btn-primary"} onClick={onConfirm} disabled={pending}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
