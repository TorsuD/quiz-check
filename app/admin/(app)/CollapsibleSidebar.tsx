"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { PanelLeftIcon } from "@/components/icons";

/*
 * Desktop sidebar that slides out of the way to give pages the full width, and back in.
 * The choice is remembered in this browser (a per-viewer convenience, so localStorage is fine).
 * Shortcut: Ctrl/⌘ + B.
 */

const KEY = "qc-sidebar-collapsed";
const EVENT = "qc-sidebar-change";

function readCollapsed() {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

function setCollapsed(value: boolean) {
  try {
    localStorage.setItem(KEY, value ? "1" : "0");
  } catch {
    // Storage blocked: the toggle still works for this page view.
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export default function CollapsibleSidebar({ children }: { children: ReactNode }) {
  // Server render and first paint: open. The saved choice applies right after hydration.
  const collapsed = useSyncExternalStore(subscribe, readCollapsed, () => false);

  // Lets the page widen while the sidebar is hidden (see the in-data-[sidebar=collapsed] classes on <main>).
  useEffect(() => {
    document.documentElement.dataset.sidebar = collapsed ? "collapsed" : "open";
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed(!readCollapsed());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <aside
        aria-label="Sidebar"
        aria-hidden={collapsed || undefined}
        inert={collapsed || undefined}
        className={`sticky top-0 hidden h-dvh shrink-0 overflow-hidden border-line bg-paper transition-[width,border-width] duration-300 ease-out motion-reduce:transition-none lg:block print:hidden ${
          collapsed ? "w-0 border-r-0" : "w-56 border-r-2"
        }`}
      >
        {/* Fixed-width inner box so the contents slide instead of squashing. */}
        <div className="relative h-full w-56 overflow-y-auto">
          {children}
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            title="Hide sidebar (Ctrl/⌘ + B)"
            aria-label="Hide sidebar"
            className="absolute top-4 right-3 flex h-8 w-8 items-center justify-center rounded-md text-stone-500 transition hover:bg-stone-100 hover:text-ink"
          >
            <PanelLeftIcon />
          </button>
        </div>
      </aside>

      {/* Shown only while the sidebar is hidden. */}
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show sidebar (Ctrl/⌘ + B)"
        aria-label="Show sidebar"
        aria-expanded={false}
        className={`fixed top-4 left-4 z-30 hidden h-9 w-9 items-center justify-center rounded-lg border-2 border-line bg-surface text-stone-600 shadow-sm transition hover:text-ink print:hidden ${
          collapsed ? "lg:flex" : ""
        }`}
      >
        <PanelLeftIcon />
      </button>
    </>
  );
}
