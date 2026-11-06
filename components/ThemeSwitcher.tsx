"use client";

import { useSyncExternalStore } from "react";
import { DEFAULT_THEME, THEMES, THEME_STORAGE_KEY, isThemeId, type ThemeId } from "@/lib/themes";

const CHANGE_EVENT = "qc-themechange";

function subscribe(onChange: () => void) {
  // Keep other open tabs in sync too.
  const onStorage = (e: StorageEvent) => {
    if (e.key === THEME_STORAGE_KEY && isThemeId(e.newValue)) document.documentElement.dataset.theme = e.newValue;
    onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): ThemeId {
  const t = document.documentElement.dataset.theme;
  return isThemeId(t) ? t : DEFAULT_THEME;
}

function setTheme(id: ThemeId) {
  document.documentElement.dataset.theme = id;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, id);
  } catch {
    // Storage blocked (private mode): the theme still applies for this page view.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Three small swatches; the theme name is in the tooltip and for screen readers. */
export default function ThemeSwitcher() {
  // null on the server: no option is highlighted until the browser knows the saved theme.
  const current = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return (
    <div role="radiogroup" aria-label="Theme" className="flex items-center gap-1">
      {THEMES.map((t) => {
        const active = current === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={`${t.label} theme`}
            title={`${t.label} theme`}
            onClick={() => setTheme(t.id)}
            className={`rounded-sm p-0.5 transition ${active ? "ring-2 ring-ink" : "opacity-60 hover:opacity-100"}`}
          >
            <span className="flex h-4 w-5 overflow-hidden rounded-[3px] border border-ink/40" aria-hidden>
              {t.swatch.map((c) => (
                <span key={c} className="h-full flex-1" style={{ background: c }} />
              ))}
            </span>
          </button>
        );
      })}
    </div>
  );
}
