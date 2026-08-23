import { alpha } from "@mui/material/styles";

interface ColorScale {
  lightest: string;
  light: string;
  main: string;
  dark: string;
  darkest: string;
  contrastText: string;
  alpha4: string;
  alpha8: string;
  alpha12: string;
  alpha30: string;
  alpha50: string;
}

const withAlphas = (color: Omit<ColorScale, `alpha${string}`>): ColorScale => ({
  ...color,
  alpha4: alpha(color.main, 0.04),
  alpha8: alpha(color.main, 0.08),
  alpha12: alpha(color.main, 0.12),
  alpha30: alpha(color.main, 0.3),
  alpha50: alpha(color.main, 0.5),
});

// -- Theme schemes -------------------------------------------------------------
//
// The app ships two dark themes that share the same neutral-overlay language
// (white hairlines, black scrims) but differ in surface temperature and accent:
//
//   - "dark"  — the original cold charcoal + peach coral accent.
//   - "amber" — a warm "darkroom / safelight" charcoal + amber accent
//               (imported from the Compose Studio console palette).
//
// Because ~130 call-sites import these color tokens *directly* (not through the
// MUI palette) and many feed them to SVG/lucide `color=`/`fill=` attributes —
// where CSS `var()` does NOT resolve — the tokens can't be CSS variables. So the
// active scheme is a module-level value and the token objects are getters that
// read it at render time, always returning a real hex string. Switching themes
// re-renders the whole tree (there are no `React.memo` barriers), so every
// getter re-reads and the UI swaps. See ``ThemeModeProvider``.

// The ordered list of schemes. Adding a theme is: append its id here, add its
// row to the palette tables below, and add a ``settings.themes.<id>`` label.
// The Settings picker renders straight from this list, so nothing else changes.
export const THEME_SCHEMES = [
  "dark",
  "amber",
  "oled",
  "midnight",
  "cinema",
  "teal",
  "mono",
  "violet",
  "forest",
  "warmteal",
] as const;

export type ThemeScheme = (typeof THEME_SCHEMES)[number];

export const THEME_STORAGE_KEY = "homeflix-theme";
export const DEFAULT_SCHEME: ThemeScheme = "dark";

export const isThemeScheme = (v: unknown): v is ThemeScheme =>
  THEME_SCHEMES.includes(v as ThemeScheme);

const readStoredScheme = (): ThemeScheme => {
  if (typeof window === "undefined") return DEFAULT_SCHEME;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeScheme(stored) ? stored : DEFAULT_SCHEME;
};

// Initialized synchronously at module load from localStorage so the very first
// paint already reads the correct scheme (no flash of the wrong theme).
let activeScheme: ThemeScheme = readStoredScheme();

export const getScheme = (): ThemeScheme => activeScheme;

/**
 * Point the token getters at a scheme. Call this *before* the state update that
 * re-renders the tree so the ensuing render reads the new palette. Managed by
 * ``ThemeModeProvider``; not for direct call-site use.
 */
export const setActiveScheme = (scheme: ThemeScheme): void => {
  activeScheme = scheme;
};

type NeutralKey = 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950;

// -- Per-scheme raw palettes (real hex) ---------------------------------------

const NEUTRAL: Record<ThemeScheme, Record<NeutralKey, string>> = {
  dark: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E8E8E8",
    300: "#D4D4D4",
    400: "#A0A0A0",
    500: "#737373",
    600: "#525252",
    700: "#2A2A2A",
    800: "#1A1A1A",
    900: "#141414",
    950: "#0D0D0D",
  },
  // Warm "darkroom" ramp — page #17140f, panel #211c15, panel-2 #2b241a,
  // rising through the warm greys to the ink off-white #f2ede3.
  amber: {
    50: "#F2EDE3",
    100: "#EBE4D8",
    200: "#DDD4C4",
    300: "#C7BDA9",
    400: "#A89E8C",
    500: "#6F6248",
    600: "#4A3F2D",
    700: "#3A3122",
    800: "#2B241A",
    900: "#211C15",
    950: "#17140F",
  },
  // Pure-black OLED ramp — page #000, cold greys. Hairlines (white-alpha) keep
  // surfaces separable against the true black.
  oled: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E8E8E8",
    300: "#D4D4D4",
    400: "#A0A0A0",
    500: "#666666",
    600: "#3D3D3D",
    700: "#262626",
    800: "#141414",
    900: "#0A0A0A",
    950: "#000000",
  },
  // Cool blue-tinted charcoal — deep navy page, rising through cool greys.
  midnight: {
    50: "#F4F6FA",
    100: "#EAEDF2",
    200: "#DADEE6",
    300: "#C2C7D2",
    400: "#9AA1B2",
    500: "#5A6272",
    600: "#3A4152",
    700: "#262C3D",
    800: "#171B28",
    900: "#11141E",
    950: "#0B0D14",
  },
  // Near-black with a faint warm/red undertone — "movie theater" surfaces.
  cinema: {
    50: "#F6F0F0",
    100: "#EFE6E6",
    200: "#E0D4D4",
    300: "#C9BABA",
    400: "#A89494",
    500: "#6B5252",
    600: "#453232",
    700: "#2E2121",
    800: "#1E1515",
    900: "#140E0E",
    950: "#0C0808",
  },
  // Cool slate — deep teal-tinted charcoal surfaces.
  teal: {
    50: "#F3F6F6",
    100: "#E9EDEE",
    200: "#D9DFE0",
    300: "#C0C9CB",
    400: "#97A3A6",
    500: "#5E6B70",
    600: "#3E4A50",
    700: "#2A3439",
    800: "#1C2529",
    900: "#141C1F",
    950: "#0E1416",
  },
  // Neutral greys — monochrome "HBO" surfaces (accent carries no hue).
  mono: {
    50: "#FAFAFA",
    100: "#F5F5F5",
    200: "#E8E8E8",
    300: "#D4D4D4",
    400: "#A3A3A3",
    500: "#6E6E6E",
    600: "#444444",
    700: "#2C2C2C",
    800: "#1B1B1B",
    900: "#131313",
    950: "#0A0A0A",
  },
  // Violet-tinted charcoal.
  violet: {
    50: "#F5F3F8",
    100: "#ECE9F1",
    200: "#DED9E7",
    300: "#C9C2D6",
    400: "#A199B8",
    500: "#665A85",
    600: "#453A63",
    700: "#2E2545",
    800: "#1F1830",
    900: "#161020",
    950: "#0F0B17",
  },
  // Deep forest-tinted charcoal.
  forest: {
    50: "#F3F6F3",
    100: "#E9EEEA",
    200: "#D9E0DA",
    300: "#C0CBC2",
    400: "#96A69A",
    500: "#566B59",
    600: "#374A3B",
    700: "#232E25",
    800: "#172018",
    900: "#101711",
    950: "#0A0F0C",
  },
  // Warm "darkroom" surfaces (same ramp as amber) paired with a cool teal
  // accent — the amber + teal combo from the Compose Studio reference.
  warmteal: {
    50: "#F2EDE3",
    100: "#EBE4D8",
    200: "#DDD4C4",
    300: "#C7BDA9",
    400: "#A89E8C",
    500: "#6F6248",
    600: "#4A3F2D",
    700: "#3A3122",
    800: "#2B241A",
    900: "#211C15",
    950: "#17140F",
  },
};

const ACCENT: Record<ThemeScheme, Omit<ColorScale, `alpha${string}`> & { rgb: string }> = {
  dark: {
    lightest: "#FBE8DD",
    light: "#E89A7C",
    main: "#D97757",
    dark: "#B85A3D",
    darkest: "#8E3F26",
    contrastText: "#0D0D0D",
    rgb: "217, 119, 87",
  },
  amber: {
    lightest: "#F6E6CB",
    light: "#ECC07F",
    main: "#E0A44A",
    dark: "#C4882F",
    darkest: "#8A5F22",
    contrastText: "#17140F",
    rgb: "224, 164, 74",
  },
  // OLED reuses the coral accent (light, so dark contrast text).
  oled: {
    lightest: "#FBE8DD",
    light: "#E89A7C",
    main: "#D97757",
    dark: "#B85A3D",
    darkest: "#8E3F26",
    contrastText: "#000000",
    rgb: "217, 119, 87",
  },
  // Azure / indigo — mid-tone, so dark contrast text reads best on the fill.
  midnight: {
    lightest: "#DCE7FD",
    light: "#86AAF5",
    main: "#5B8DEF",
    dark: "#3E6BD1",
    darkest: "#24427F",
    contrastText: "#0B0D14",
    rgb: "91, 141, 239",
  },
  // Cinema red — deep enough that white label text keeps AA contrast.
  cinema: {
    lightest: "#FAD6D7",
    light: "#E86C70",
    main: "#D8383E",
    dark: "#B62A31",
    darkest: "#7A1D22",
    contrastText: "#FFFFFF",
    rgb: "216, 56, 62",
  },
  // Teal — light, so dark contrast text.
  teal: {
    lightest: "#D3F1EE",
    light: "#86D6CF",
    main: "#5BC6BD",
    dark: "#3FA69D",
    darkest: "#1F5F59",
    contrastText: "#0E1416",
    rgb: "91, 198, 189",
  },
  // Pure white accent (HBO-style mono). Tints read as white-alpha, so selected
  // states lean on brightness/weight rather than hue — an intentional look.
  mono: {
    lightest: "#FFFFFF",
    light: "#FFFFFF",
    main: "#FFFFFF",
    dark: "#E2E2E2",
    darkest: "#C7C7C7",
    contrastText: "#0A0A0A",
    rgb: "255, 255, 255",
  },
  // Soft violet — light enough for dark contrast text.
  violet: {
    lightest: "#EBE3FE",
    light: "#C4B2FC",
    main: "#A78BFA",
    dark: "#8B6DF0",
    darkest: "#5B3FB0",
    contrastText: "#12091F",
    rgb: "167, 139, 250",
  },
  // Emerald — distinct from the cyan "teal" theme and the status green.
  forest: {
    lightest: "#D1FAE5",
    light: "#6EE7B7",
    main: "#34D399",
    dark: "#10B981",
    darkest: "#065F46",
    contrastText: "#06120C",
    rgb: "52, 211, 153",
  },
  // Amber primary on warm surfaces (the "Copiar" button in the reference).
  // The teal "Rodar" button is the secondary accent — see SECONDARY_ACCENT.
  warmteal: {
    lightest: "#F6E6CB",
    light: "#ECC07F",
    main: "#E0A44A",
    dark: "#C4882F",
    darkest: "#8A5F22",
    contrastText: "#17140F",
    rgb: "224, 164, 74",
  },
};

// -- Optional secondary accent -------------------------------------------------
//
// Most schemes leave the ``hairline`` (secondary) button neutral. A scheme can
// opt into a colored secondary here; ``warmteal`` uses teal so the theme reads
// as the reference's amber-primary + teal-secondary duotone.
export interface SecondaryAccent {
  main: string;
  /** Readable label tone on a dark surface. */
  text: string;
  rgb: string;
}

const SECONDARY_ACCENT: Partial<Record<ThemeScheme, SecondaryAccent>> = {
  warmteal: { main: "#5BC6BD", text: "#86D6CF", rgb: "91, 198, 189" },
};

export const secondaryAccentFor = (
  scheme: ThemeScheme,
): SecondaryAccent | undefined => SECONDARY_ACCENT[scheme];

// Body text (``--fg``) and muted secondary tone (``--muted``) per scheme.
const FG: Record<ThemeScheme, string> = {
  dark: "#F5F1EB",
  amber: "#F2EDE3",
  oled: "#F5F1EB",
  midnight: "#EDF0F7",
  cinema: "#F5ECEC",
  teal: "#EAF1F0",
  mono: "#F5F5F5",
  violet: "#EFEAF7",
  forest: "#EAF2EC",
  warmteal: "#F2EDE3",
};
const MUTED: Record<ThemeScheme, string> = {
  dark: "#8A857E",
  amber: "#A89E8C",
  oled: "#8A857E",
  midnight: "#9AA1B2",
  cinema: "#A89494",
  teal: "#97A3A6",
  mono: "#8F8F8F",
  violet: "#A199B8",
  forest: "#96A69A",
  warmteal: "#A89E8C",
};
// Frosted menu/popover surface base (``menuScrim``).
const PANEL_2: Record<ThemeScheme, string> = {
  dark: "#1C1C1C",
  amber: "#2B241A",
  oled: "#141414",
  midnight: "#171B28",
  cinema: "#1E1515",
  teal: "#1C2529",
  mono: "#1B1B1B",
  violet: "#1F1830",
  forest: "#172018",
  warmteal: "#2B241A",
};

// -- Scheme accessors (real hex, for the theme factory) ------------------------
//
// Used by ``buildTheme(scheme)`` to bake each MUI theme object with pinned,
// scheme-specific values (so the two theme objects genuinely differ). Call-site
// tokens use the getters below instead.

export const neutralFor = (scheme: ThemeScheme) => NEUTRAL[scheme];
export const accentFor = (scheme: ThemeScheme) => ACCENT[scheme];
export const fgFor = (scheme: ThemeScheme) => FG[scheme];
export const mutedFor = (scheme: ThemeScheme) => MUTED[scheme];
export const panel2For = (scheme: ThemeScheme) => PANEL_2[scheme];

// -- Live token objects (getters read the active scheme at render) -------------

/**
 * Neutral grey ramp for the active scheme. ``neutral[950]`` etc. return a real
 * hex string, resolved on every access, so the same call-site swaps between the
 * cold and warm ramps when the theme changes.
 */
export const neutral = new Proxy({} as Record<NeutralKey, string>, {
  get: (_target, prop) => NEUTRAL[activeScheme][Number(prop) as NeutralKey],
});

/**
 * Accent scale for the active scheme (peach in "dark", amber in "amber").
 * Mirrors ``theme.palette.primary`` but is safe to feed to SVG/lucide
 * attributes because it always resolves to a real hex / rgba string.
 */
export const peach = new Proxy({} as ColorScale, {
  get: (_target, prop) => {
    const a = ACCENT[activeScheme];
    switch (prop) {
      case "lightest":
        return a.lightest;
      case "light":
        return a.light;
      case "main":
        return a.main;
      case "dark":
        return a.dark;
      case "darkest":
        return a.darkest;
      case "contrastText":
        return a.contrastText;
      case "alpha4":
        return `rgba(${a.rgb}, 0.04)`;
      case "alpha8":
        return `rgba(${a.rgb}, 0.08)`;
      case "alpha12":
        return `rgba(${a.rgb}, 0.12)`;
      case "alpha30":
        return `rgba(${a.rgb}, 0.3)`;
      case "alpha50":
        return `rgba(${a.rgb}, 0.5)`;
      default:
        return undefined;
    }
  },
});

// -- Status palettes (universal — identical across schemes) --------------------

export const success = withAlphas({
  lightest: "#DCFCE7",
  light: "#86EFAC",
  main: "#4ADE80",
  dark: "#22C55E",
  darkest: "#14532D",
  contrastText: "#FFFFFF",
});

export const info = withAlphas({
  lightest: "#E0F2FE",
  light: "#7DD3FC",
  main: "#60A5FA",
  dark: "#3B82F6",
  darkest: "#1E40AF",
  contrastText: "#FFFFFF",
});

export const warning = withAlphas({
  lightest: "#FEF3C7",
  light: "#FDE047",
  main: "#FBBF24",
  dark: "#F59E0B",
  darkest: "#78350F",
  contrastText: "#0D0D0D",
});

export const error = withAlphas({
  lightest: "#FEE2E2",
  light: "#FCA5A5",
  main: "#F87171",
  dark: "#EF4444",
  darkest: "#7F1D1D",
  contrastText: "#FFFFFF",
});
