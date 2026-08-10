/**
 * Accent themes — swap the brand's primary + accent hues live. Applied by
 * setting CSS custom properties on :root (see ThemeAccentProvider / the
 * pre-paint script in the root layout). Values are tuned for the dark UI but
 * read fine in light mode too.
 */

export type AccentTheme = {
  id: string;
  name: string;
  /** CSS values written to the corresponding custom properties. */
  primary: string;
  primaryForeground: string;
  brandAccent: string;
};

export const ACCENTS: AccentTheme[] = [
  { id: "iris", name: "Iris", primary: "oklch(0.62 0.235 280)", primaryForeground: "oklch(0.99 0.01 280)", brandAccent: "oklch(0.8 0.14 205)" },
  { id: "jira", name: "Jira Blue", primary: "oklch(0.6 0.19 250)", primaryForeground: "oklch(0.99 0.01 250)", brandAccent: "oklch(0.74 0.13 220)" },
  { id: "asana", name: "Asana Coral", primary: "oklch(0.65 0.2 25)", primaryForeground: "oklch(0.99 0.01 25)", brandAccent: "oklch(0.7 0.17 350)" },
  { id: "linear", name: "Linear Violet", primary: "oklch(0.6 0.22 300)", primaryForeground: "oklch(0.99 0.01 300)", brandAccent: "oklch(0.72 0.16 285)" },
  { id: "emerald", name: "Emerald", primary: "oklch(0.66 0.16 158)", primaryForeground: "oklch(0.16 0.03 158)", brandAccent: "oklch(0.8 0.16 135)" },
  { id: "teal", name: "Teal", primary: "oklch(0.66 0.13 195)", primaryForeground: "oklch(0.16 0.03 195)", brandAccent: "oklch(0.76 0.12 220)" },
  { id: "sky", name: "Sky", primary: "oklch(0.64 0.16 235)", primaryForeground: "oklch(0.99 0.01 235)", brandAccent: "oklch(0.79 0.13 205)" },
  { id: "rose", name: "Rose", primary: "oklch(0.63 0.21 12)", primaryForeground: "oklch(0.99 0.01 12)", brandAccent: "oklch(0.7 0.18 350)" },
  { id: "fuchsia", name: "Fuchsia", primary: "oklch(0.62 0.25 330)", primaryForeground: "oklch(0.99 0.01 330)", brandAccent: "oklch(0.72 0.18 300)" },
  { id: "amber", name: "Amber", primary: "oklch(0.76 0.15 72)", primaryForeground: "oklch(0.18 0.04 72)", brandAccent: "oklch(0.72 0.15 45)" },
  { id: "lime", name: "Lime", primary: "oklch(0.76 0.18 130)", primaryForeground: "oklch(0.18 0.05 130)", brandAccent: "oklch(0.82 0.15 110)" },
  { id: "slate", name: "Graphite", primary: "oklch(0.72 0.03 265)", primaryForeground: "oklch(0.16 0.02 265)", brandAccent: "oklch(0.78 0.03 265)" },
];

export const DEFAULT_ACCENT = "iris";
export const ACCENT_STORAGE_KEY = "shipflow-accent";

export function findAccent(id: string | null | undefined): AccentTheme {
  return ACCENTS.find((a) => a.id === id) ?? ACCENTS[0]!;
}

/** Apply an accent to the document root (client-only). */
export function applyAccent(accent: AccentTheme): void {
  const r = document.documentElement.style;
  r.setProperty("--primary", accent.primary);
  r.setProperty("--primary-foreground", accent.primaryForeground);
  r.setProperty("--brand-accent", accent.brandAccent);
  r.setProperty("--ring", accent.primary);
}
