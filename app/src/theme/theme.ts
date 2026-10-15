export type ThemePref = "system" | "light" | "dark";
export type Theme = "light" | "dark";

export const THEME_KEY = "theme-pref";
export const THEME_COLORS: Record<Theme, string> = { light: "#F2F2F7", dark: "#1E242C" };

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

export function setThemePref(p: ThemePref): void {
  try {
    if (p === "system") localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, p);
  } catch {
    // private mode: the choice lasts for this page only
  }
}

export function systemPrefersDark(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-color-scheme: dark)").matches;
}

export function resolveTheme(p: ThemePref, prefersDark: boolean): Theme {
  return p === "system" ? (prefersDark ? "dark" : "light") : p;
}

export function applyTheme(t: Theme, doc: Document = document): void {
  doc.documentElement.dataset.theme = t;
  doc.documentElement.style.colorScheme = t;
  let meta = doc.head.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = doc.createElement("meta");
    meta.setAttribute("name", "theme-color");
    doc.head.appendChild(meta);
  }
  meta.setAttribute("content", THEME_COLORS[t]);
}
