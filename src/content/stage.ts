export type ThemeMode = "light" | "dark";

export const THEME: ThemeMode = "light";

const THEMES = {
  light: {
    pageBg: "#f4f4f5",
    cardFace: "#ffffff",
    ink: "#000000",
  },
  dark: {
    pageBg: "#0a0a0a",
    cardFace: "#161616",
    ink: "#ffffff",
  },
} as const;

export const PAGE_BG = THEMES[THEME].pageBg;
export const CARD_FACE = THEMES[THEME].cardFace;
export const CARD_INK = THEMES[THEME].ink;
