/**
 * Visual themes. The look is driven by CSS variables in app/globals.css, keyed by
 * the `data-theme` attribute on <html>.
 *
 * DEFAULT_THEME is what everyone sees (including students) until they pick another
 * theme with the switcher in the admin header. That choice is remembered per browser.
 */
export const THEMES = [
  { id: "retro", label: "Retro", swatch: ["#f4ecd8", "#2563eb", "#facc15"] },
  { id: "editorial", label: "Editorial", swatch: ["#f8f5ef", "#24477c", "#ecdfbf"] },
  { id: "dark", label: "Dark", swatch: ["#0b0d12", "#6d5efc", "#e7e9ee"] },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "retro";
export const THEME_STORAGE_KEY = "qc-theme";

export function isThemeId(value: unknown): value is ThemeId {
  return THEMES.some((t) => t.id === value);
}

/** Runs before first paint so a saved theme never flashes the default one. */
export const THEME_BOOT_SCRIPT = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(${JSON.stringify(
  THEMES.map((t) => t.id),
)}.indexOf(t)>-1)document.documentElement.dataset.theme=t}catch(e){}`;
