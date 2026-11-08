"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark, MenuIcon, Wordmark, XIcon } from "@/components/icons";

/** Small-screen top bar; the Menu button slides the sidebar (passed as children) in from the left. */
export default function MobileNav({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b-2 border-line bg-paper px-4 py-3 lg:hidden print:hidden">
        <Link href="/admin" className="flex items-center gap-2.5">
          <LogoMark />
          <Wordmark />
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="admin-drawer"
          className="btn-secondary px-3 py-2"
        >
          <MenuIcon /> Menu
        </button>
      </header>

      {open && (
        <div className="fixed inset-0 z-30 lg:hidden">
          <div className="absolute inset-0 bg-stone-900/40" onClick={() => setOpen(false)} aria-hidden />
          <div
            id="admin-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r-2 border-line bg-paper shadow-xl"
            // Close after following a link inside the drawer.
            onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute top-4 right-3 rounded-md p-2 text-stone-500 hover:bg-stone-100 hover:text-ink"
            >
              <XIcon />
            </button>
            {children}
          </div>
        </div>
      )}
    </>
  );
}
