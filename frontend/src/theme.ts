export interface ThemeColors {
  bg: string;
  surface: string;
  surface2: string;
  border: string;
  text: string;
  textSoft: string;
  accent: string;
  accentSoft: string;
  accentFg: string;
  success: string;
  successSoft: string;
  amber: string;
  amberSoft: string;
  neutral: string;
  neutralSoft: string;
  danger: string;
  dangerSoft: string;
}

export const THEMES: Record<"light" | "dark", ThemeColors> = {
  light: {
    bg: "oklch(97% 0.004 250)",
    surface: "oklch(100% 0 0)",
    surface2: "oklch(95.5% 0.005 250)",
    border: "oklch(89% 0.006 250)",
    text: "oklch(24% 0.012 250)",
    textSoft: "oklch(48% 0.01 250)",
    accent: "oklch(52% 0.14 237)",
    accentSoft: "oklch(93% 0.03 237)",
    accentFg: "white",
    success: "oklch(48% 0.13 148)",
    successSoft: "oklch(94% 0.05 148)",
    amber: "oklch(56% 0.15 70)",
    amberSoft: "oklch(94% 0.06 75)",
    neutral: "oklch(50% 0.01 250)",
    neutralSoft: "oklch(92% 0.006 250)",
    danger: "oklch(55% 0.19 25)",
    dangerSoft: "oklch(94% 0.06 25)",
  },
  dark: {
    bg: "oklch(19% 0.012 250)",
    surface: "oklch(24% 0.013 250)",
    surface2: "oklch(28% 0.014 250)",
    border: "oklch(33% 0.014 250)",
    text: "oklch(95% 0.006 250)",
    textSoft: "oklch(72% 0.012 250)",
    accent: "oklch(72% 0.13 237)",
    accentSoft: "oklch(30% 0.05 237)",
    accentFg: "oklch(15% 0.01 237)",
    success: "oklch(72% 0.14 148)",
    successSoft: "oklch(28% 0.06 148)",
    amber: "oklch(78% 0.15 75)",
    amberSoft: "oklch(32% 0.07 75)",
    neutral: "oklch(68% 0.012 250)",
    neutralSoft: "oklch(30% 0.01 250)",
    danger: "oklch(70% 0.18 25)",
    dangerSoft: "oklch(32% 0.08 25)",
  },
};

export function cssVars(c: ThemeColors): Record<string, string> {
  return {
    "--bg": c.bg,
    "--surface": c.surface,
    "--surface-2": c.surface2,
    "--border": c.border,
    "--text": c.text,
    "--text-soft": c.textSoft,
    "--accent": c.accent,
    "--accent-soft": c.accentSoft,
    "--accent-fg": c.accentFg,
    "--success": c.success,
    "--success-soft": c.successSoft,
    "--amber": c.amber,
    "--amber-soft": c.amberSoft,
    "--neutral": c.neutral,
    "--neutral-soft": c.neutralSoft,
    "--danger": c.danger,
    "--danger-soft": c.dangerSoft,
  };
}

export function scoreVisual(score: number): { bg: string; fg: string } {
  if (score >= 8) return { bg: "var(--success-soft)", fg: "var(--success)" };
  if (score >= 5) return { bg: "var(--amber-soft)", fg: "var(--amber)" };
  return { bg: "var(--neutral-soft)", fg: "var(--neutral)" };
}

export function dpeVisual(letter: string | null): { bg: string; fg: string } | null {
  if (!letter) return null;
  if (letter === "A" || letter === "B") return { bg: "var(--success-soft)", fg: "var(--success)" };
  if (letter === "C" || letter === "D") return { bg: "var(--amber-soft)", fg: "var(--amber)" };
  return { bg: "var(--danger-soft)", fg: "var(--danger)" };
}
