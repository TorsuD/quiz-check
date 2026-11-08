"use client";

import { useEffect, useState } from "react";

/** Opens the browser's print dialog (choose "Save as PDF" to keep a copy of the report). */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-secondary">
      <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M6 9V3h12v6M6 18H4a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7z" />
      </svg>
      Print / PDF
    </button>
  );
}

/** Sticky jump-menu for the report sections; highlights the section currently on screen. */
export function SectionNav({ sections }: { sections: { id: string; label: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id);
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(s.id)).filter((e): e is HTMLElement => e !== null);
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-80px 0px -60% 0px" },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [sections]);

  return (
    <nav
      aria-label="Report sections"
      className="sticky top-14 z-10 -mx-1 overflow-x-auto rounded-xl border-2 border-line bg-surface/85 p-1 shadow-sm backdrop-blur lg:top-4 print:hidden"
    >
      <ul className="flex min-w-max gap-1">
        {sections.map((s, i) => (
          <li key={s.id}>
            <a
              href={`#${s.id}`}
              aria-current={active === s.id ? "true" : undefined}
              className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                active === s.id ? "bg-brand-600 text-white" : "text-stone-600 hover:bg-stone-100 hover:text-ink"
              }`}
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold ${
                  active === s.id ? "bg-white/20" : "bg-stone-100 text-stone-500"
                }`}
              >
                {i + 1}
              </span>
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
