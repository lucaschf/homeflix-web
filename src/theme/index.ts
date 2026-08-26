import {
  alpha,
  createTheme,
  type Theme,
  type ThemeOptions,
} from "@mui/material/styles";
import {
  accentFor,
  type CtaStyle,
  error,
  fgFor,
  info,
  mutedFor,
  neutralFor,
  secondaryAccentFor,
  success,
  type ThemeScheme,
  warning,
} from "./colors";
import { border, fontFamily, fontSize, status, whiteAlpha } from "./tokens";
import React from "react";

// -- Overlay token namespace ---------------------------------------------------
//
// Tokens used by components that paint text on top of dark video frames or
// gradient overlays — currently the player heading, time readout, "preparing
// video" loader, and the auto-advance countdown. They live in the MUI palette
// and typography slots so consumers can use the standard `color="..."` and
// `variant="..."` props instead of inlining hex strings and responsive
// fontSize literals.
//
// When you find yourself reaching for `color="#fff"` or
// `color="rgba(255,255,255,0.7)"` on a dark surface, use these instead. New
// overlay components (EpisodeDrawer, SubtitleMenu, etc.) should default to
// these tokens.
//
// Sub-tokens:
// - `overlayText.primary`   — high-contrast white for the main label
// - `overlayText.secondary` — dimmer 70% white for captions and metadata
// - typography variants `overlayTitle` / `overlaySubtitle` / `overlayTimestamp`
//   carry the responsive font sizes (xs/md) used by the player heading row, so
//   each Typography stays a single line of JSX.

// Shared overlay color shape — declared once and referenced by both the
// required `Palette` and the optional `PaletteOptions` interfaces so the two
// sides can't drift when a new sub-token is added.
interface OverlayText {
  primary: string;
  secondary: string;
}

declare module "@mui/material/styles" {
  interface Palette {
    overlayText: OverlayText;
  }
  interface PaletteOptions {
    overlayText?: OverlayText;
  }
  interface TypographyVariants {
    overlayTitle: React.CSSProperties;
    overlaySubtitle: React.CSSProperties;
    overlayTimestamp: React.CSSProperties;
    eyebrow: React.CSSProperties;
    pageTitle: React.CSSProperties;
    pageSubtitle: React.CSSProperties;
    breadcrumb: React.CSSProperties;
    cardSubtitle: React.CSSProperties;
    statValue: React.CSSProperties;
    metaMono: React.CSSProperties;
    control: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    overlayTitle?: React.CSSProperties;
    overlaySubtitle?: React.CSSProperties;
    overlayTimestamp?: React.CSSProperties;
    eyebrow?: React.CSSProperties;
    pageTitle?: React.CSSProperties;
    pageSubtitle?: React.CSSProperties;
    breadcrumb?: React.CSSProperties;
    cardSubtitle?: React.CSSProperties;
    statValue?: React.CSSProperties;
    metaMono?: React.CSSProperties;
    control?: React.CSSProperties;
  }
}

// Canonical interactive-control variants (ADR-001). The four looks every
// action bar / toolbar needs, registered once so call-sites stop hand-rolling
// coral CTAs and hairline secondaries with divergent radius/border/weight.
declare module "@mui/material/Button" {
  interface ButtonPropsVariantOverrides {
    /** Primary coral CTA — "Assistir", "Reproduzir fila". */
    cta: true;
    /** Secondary hairline button — "Trailer", "Aleatório", sort control. */
    hairline: true;
    /** Transparent, label-only button. */
    ghost: true;
    /** Destructive, red-tinted button. */
    danger: true;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    overlayTitle: true;
    overlaySubtitle: true;
    overlayTimestamp: true;
    eyebrow: true;
    pageTitle: true;
    pageSubtitle: true;
    breadcrumb: true;
    cardSubtitle: true;
    statValue: true;
    metaMono: true;
    control: true;
  }
}

// Overlay text (heading/time readout over video) uses the scheme's warm matte
// off-white (``--fg``) instead of pure white which glares. Kept solid (no
// alpha) for the primary tier because it paints over bright video frames; the
// secondary tier uses the same warm tone at 70%. Computed per scheme inside the
// factory below.

// Build a throwaway default theme just to read the canonical breakpoint
// helper. The breakpoint media query string then tracks any future change to
// `breakpoints.values.md` automatically — no hardcoded `@media (min-width:Xpx)`
// constants to keep in sync.
const defaultTheme = createTheme();
const OVERLAY_BREAKPOINT_MD = defaultTheme.breakpoints.up("md");

// Shared base for the canonical Button variants (ADR-001): compact toolbar
// padding, control type scale and `none` transform. Spread into each variant
// so only the colors/border differ. Padding is the raw-px equivalent of the
// former AdminButton `py: 0.875 / px: 1.75` (× 8px spacing).
const CONTROL_BASE = {
  textTransform: "none" as const,
  fontWeight: 500,
  fontSize: fontSize.control,
  paddingBlock: "7px",
  paddingInline: "14px",
  transition: "background-color 140ms ease, border-color 140ms ease",
  // Shared disabled treatment. MUI only dims the *text* (to
  // ``action.disabled``) for these custom variants and leaves each variant's
  // own background in place — so a filled ``cta`` kept its bright accent fill
  // with barely-legible text. Here the text stays a readable muted grey; the
  // filled ``cta`` also drops its fill below (``&&`` beats MUI's built-in
  // ``.Mui-disabled`` rule).
  "&&.Mui-disabled": {
    color: whiteAlpha(0.4),
  },
};

// Build the full ThemeOptions for a scheme. Every scheme-varying color is
// pinned to that scheme's real hex here (the two resulting theme objects
// genuinely differ), while the direct-import tokens in ``colors.ts`` /
// ``tokens.ts`` follow the active scheme at render time for the ~130 call-sites
// that consume them outside the MUI palette.
const buildThemeOptions = (
  scheme: ThemeScheme,
  ctaStyle: CtaStyle,
): ThemeOptions => {
  const n = neutralFor(scheme);
  const a = accentFor(scheme);
  const fg = fgFor(scheme);
  const muted = mutedFor(scheme);
  // Optional colored secondary button (e.g. teal in "warmteal"). When unset the
  // hairline variant stays neutral.
  const secondary = secondaryAccentFor(scheme);
  // Primary CTA fill. "neutral" swaps the accent for white so the main button
  // reads neutral while the rest of the theme keeps its colors.
  const cta =
    ctaStyle === "neutral"
      ? { fill: "#FFFFFF", text: "#0A0A0A", hover: "#E2E2E2" }
      : { fill: a.main, text: a.contrastText, hover: a.dark };

  // Real accent scale for the MUI palette (peach in "dark", amber in "amber").
  // Kept a plain object with real hex so MUI can compute channels / hover
  // states — the ``peach`` proxy export is for call-sites, not the palette.
  const primary = {
    lightest: a.lightest,
    light: a.light,
    main: a.main,
    dark: a.dark,
    darkest: a.darkest,
    contrastText: a.contrastText,
    alpha4: alpha(a.main, 0.04),
    alpha8: alpha(a.main, 0.08),
    alpha12: alpha(a.main, 0.12),
    alpha30: alpha(a.main, 0.3),
    alpha50: alpha(a.main, 0.5),
  };

  return {
  colorSchemes: {
    dark: {
      palette: {
        primary,
        error,
        info,
        success,
        warning,
        background: {
          default: n[950],
          paper: n[900],
        },
        text: {
          // Warm off-white (``--fg``) at 92% opacity instead of the near-pure
          // ``neutral[50]``, which glares against the dark surfaces. The slight
          // transparency lets the dark background bleed through for a softer /
          // more matte read that's easier on the eyes for long sessions.
          primary: alpha(fg, 0.92),
          // The scheme's ``--muted`` tone — a warmer / slightly darker grey
          // used for every "muted" surface: eyebrows, page subtitles, sidebar
          // inactive items, hint copy.
          secondary: muted,
          disabled: n[600],
        },
        divider: n[700],
        action: {
          active: n[400],
          hover: `rgba(255, 255, 255, 0.08)`,
          selected: `rgba(255, 255, 255, 0.16)`,
          disabled: `rgba(255, 255, 255, 0.3)`,
          disabledBackground: `rgba(255, 255, 255, 0.12)`,
        },
        overlayText: {
          primary: fg,
          secondary: alpha(fg, 0.7),
        },
      },
    },
  },
  defaultColorScheme: "dark",
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: {
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      fontSize: "1.75rem",
      fontWeight: 700,
      lineHeight: 1.3,
      letterSpacing: "-0.025em",
    },
    h2: {
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      fontSize: "1.375rem",
      fontWeight: 600,
      lineHeight: 1.3,
      letterSpacing: "-0.02em",
    },
    h3: {
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      fontSize: "1.125rem",
      fontWeight: 600,
      lineHeight: 1.4,
      letterSpacing: "-0.015em",
    },
    body1: { fontSize: "0.875rem", lineHeight: 1.5 },
    body2: { fontSize: "0.75rem", lineHeight: 1.5 },
    caption: { fontSize: "0.6875rem", fontWeight: 500, lineHeight: 1.4 },
    button: { textTransform: "none", fontWeight: 600 },
    eyebrow: {
      fontFamily: fontFamily.mono,
      fontSize: "0.6875rem",
      fontWeight: 500,
      lineHeight: 1.4,
      letterSpacing: "0.18em",
      textTransform: "uppercase",
    },
    overlayTitle: {
      fontSize: "0.95rem",
      fontWeight: 600,
      lineHeight: 1.25,
      [OVERLAY_BREAKPOINT_MD]: {
        fontSize: "1.1rem",
      },
    },
    overlaySubtitle: {
      fontSize: "0.78rem",
      lineHeight: 1.25,
      [OVERLAY_BREAKPOINT_MD]: {
        fontSize: "0.85rem",
      },
    },
    overlayTimestamp: {
      fontSize: "0.85rem",
      lineHeight: 1.5,
      [OVERLAY_BREAKPOINT_MD]: {
        fontSize: "0.95rem",
      },
    },
    pageTitle: {
      fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
      fontSize: "2rem",
      fontWeight: 600,
      lineHeight: 1.1,
      letterSpacing: "-0.02em",
    },
    pageSubtitle: {
      fontSize: "1rem",
      lineHeight: 1.55,
    },
    breadcrumb: {
      fontFamily: fontFamily.mono,
      fontSize: "0.8rem",
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      lineHeight: 1.4,
    },
    cardSubtitle: {
      fontSize: "0.9375rem",
      lineHeight: 1.5,
    },
    statValue: {
      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
      fontSize: "2.2rem",
      fontWeight: 500,
      letterSpacing: "-0.025em",
      lineHeight: 1,
    },
    metaMono: {
      fontFamily: fontFamily.mono,
      fontSize: "0.78125rem",
      lineHeight: 1.4,
    },
    control: {
      fontSize: fontSize.control,
      fontWeight: 500,
      lineHeight: 1.4,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiTypography: {
      defaultProps: {
        // Custom typography variants registered via module augmentation
        // (overlayTitle / overlaySubtitle / overlayTimestamp) need an
        // explicit HTML element here. MUI's built-in fallback for unknown
        // variants is `<span>`, which is inline — that made the player
        // heading title and subtitle land side-by-side instead of
        // stacking. `<div>` keeps them as block elements while staying
        // semantically neutral (they are short overlay labels, not
        // paragraphs, so `<p>` would be wrong).
        variantMapping: {
          overlayTitle: "div",
          overlaySubtitle: "div",
          overlayTimestamp: "div",
          eyebrow: "div",
          pageTitle: "h1",
          pageSubtitle: "p",
          breadcrumb: "div",
          cardSubtitle: "p",
          statValue: "div",
          metaMono: "span",
          control: "span",
        },
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        // Bump the document root so every ``rem``-based size in
        // the theme + hardcoded ``sx`` values scales up ~19 %.
        // 16 px was visibly tight against the admin design spec
        // (subtitle, eyebrows and sub-label copy all reading
        // smaller than the mockup). 19 px lands those at
        // 13-17 px while keeping h1 + stat numbers in their
        // intended range (28-36 px).
        html: {
          fontSize: "19px",
        },
        body: {
          backgroundColor: n[950],
          scrollbarColor: `${n[700]} transparent`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      // Canonical interactive-control variants (ADR-001). Each carries the
      // FULL look — colors, hairline, weight, compact padding, `none`
      // text-transform — so call-sites no longer hand-roll coral CTAs and
      // hairline secondaries with divergent radius/border/weight. Border
      // radius is intentionally NOT set here: it inherits `shape.borderRadius`
      // (8px), the single canonical control radius. Scale (a taller hero
      // height) is layered per call-site via `sx`, never the look.
      variants: [
        {
          props: { variant: "cta" },
          style: () => ({
            ...CONTROL_BASE,
            fontWeight: 600,
            backgroundColor: cta.fill,
            color: cta.text,
            border: `1px solid ${cta.fill}`,
            "&:hover": {
              backgroundColor: cta.hover,
              borderColor: cta.hover,
            },
            // Disabled: drop the bright accent fill for a muted panel so the
            // button reads as inactive and the label stays legible (the base
            // ``CONTROL_BASE`` rule already sets the readable text color).
            "&&.Mui-disabled": {
              backgroundColor: whiteAlpha(0.06),
              borderColor: "transparent",
              color: whiteAlpha(0.4),
            },
          }),
        },
        {
          props: { variant: "hairline" },
          style: ({ theme }) =>
            secondary
              ? {
                  // Colored secondary (teal in "warmteal") — tinted outline so
                  // it pairs with the amber primary without shouting.
                  ...CONTROL_BASE,
                  backgroundColor: alpha(secondary.main, 0.1),
                  color: secondary.text,
                  border: `1px solid ${alpha(secondary.main, 0.4)}`,
                  "&:hover": {
                    backgroundColor: alpha(secondary.main, 0.16),
                    borderColor: alpha(secondary.main, 0.55),
                  },
                }
              : {
                  ...CONTROL_BASE,
                  backgroundColor: whiteAlpha(0.04),
                  color: theme.palette.text.primary,
                  border: `1px solid ${border.hairline}`,
                  "&:hover": { backgroundColor: whiteAlpha(0.07) },
                },
        },
        {
          props: { variant: "ghost" },
          style: ({ theme }) => ({
            ...CONTROL_BASE,
            backgroundColor: "transparent",
            color: theme.palette.text.secondary,
            border: "1px solid transparent",
            "&:hover": {
              backgroundColor: whiteAlpha(0.04),
              color: theme.palette.text.primary,
            },
          }),
        },
        {
          props: { variant: "danger" },
          style: {
            ...CONTROL_BASE,
            backgroundColor: alpha(status.err.base, 0.08),
            color: status.err.fg,
            border: `1px solid ${alpha(status.err.base, 0.35)}`,
            "&:hover": { backgroundColor: alpha(status.err.base, 0.14) },
          },
        },
      ],
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 12,
          border: `1px solid ${n[700]}`,
        },
      },
    },
    // Every modal shares one surface: the dashboard StatCard recipe —
    // a solid ``neutral[950]`` base lifted by a flat 2.5% white overlay
    // (via ``backgroundImage``, which also cancels MUI's elevation
    // gradient) plus the same hairline border. Keeps dialogs from
    // drifting between the lighter ``background.paper`` and the darker
    // ``neutral[950]`` they used before. Per-dialog code should no
    // longer set its own paper ``backgroundColor``.
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundColor: n[950],
          backgroundImage: `linear-gradient(${whiteAlpha(0.025)}, ${whiteAlpha(0.025)})`,
          border: `1px solid ${whiteAlpha(0.08)}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: n[900],
          borderRight: `1px solid ${n[700]}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: n[900],
          backgroundImage: "none",
          borderBottom: `1px solid ${n[700]}`,
        },
      },
    },
  },
  };
};

// One MUI theme object per (scheme, ctaStyle) pair, built lazily and memoized.
// They share everything except the scheme-pinned colors and the primary-button
// style baked in above; ``App`` swaps which one is active.
const themeCache = new Map<string, Theme>();

export const themeFor = (scheme: ThemeScheme, ctaStyle: CtaStyle): Theme => {
  const key = `${scheme}:${ctaStyle}`;
  let built = themeCache.get(key);
  if (!built) {
    built = createTheme(buildThemeOptions(scheme, ctaStyle));
    themeCache.set(key, built);
  }
  return built;
};

/** Default theme (cold + peach, accent CTA). For consumers that import a static theme. */
export const theme = themeFor("dark", "accent");
