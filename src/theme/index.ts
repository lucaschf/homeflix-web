import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { error, info, neutral, peach, success, warning } from "./colors";
import { inkAlpha } from "./tokens";
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
  }
}

// Warm matte off-white (``--fg``) to match the body text, instead of pure
// white which glares. Kept solid (no alpha) because this paints over video
// frames that can be bright — letting the frame bleed through would hurt
// legibility. The secondary tier uses the same warm tone at 70%.
const OVERLAY_TEXT_PRIMARY = "#F5F1EB";
const OVERLAY_TEXT_SECONDARY = inkAlpha(0.7);

// Build a throwaway default theme just to read the canonical breakpoint
// helper. The breakpoint media query string then tracks any future change to
// `breakpoints.values.md` automatically — no hardcoded `@media (min-width:Xpx)`
// constants to keep in sync.
const defaultTheme = createTheme();
const OVERLAY_BREAKPOINT_MD = defaultTheme.breakpoints.up("md");

const themeOptions: ThemeOptions = {
  colorSchemes: {
    dark: {
      palette: {
        primary: peach,
        error,
        info,
        success,
        warning,
        background: {
          default: neutral[950],
          paper: neutral[900],
        },
        text: {
          // Warm off-white from the design handoff (``--fg`` = #F5F1EB) at 92%
          // opacity instead of the near-pure ``neutral[50]`` (#FAFAFA), which
          // glares against the dark surfaces. The slight transparency lets the
          // dark background bleed through for a softer / more matte read that's
          // easier on the eyes for long sessions.
          primary: inkAlpha(0.92),
          // ``#8A857E`` matches the admin design's ``--muted`` token
          // — a warmer / slightly darker tone than ``neutral[400]``
          // that the spec uses for every "muted" surface: eyebrows,
          // page subtitles, sidebar inactive items, hint copy.
          secondary: "#8A857E",
          disabled: neutral[600],
        },
        divider: neutral[700],
        action: {
          active: neutral[400],
          hover: `rgba(255, 255, 255, 0.08)`,
          selected: `rgba(255, 255, 255, 0.16)`,
          disabled: `rgba(255, 255, 255, 0.3)`,
          disabledBackground: `rgba(255, 255, 255, 0.12)`,
        },
        overlayText: {
          primary: OVERLAY_TEXT_PRIMARY,
          secondary: OVERLAY_TEXT_SECONDARY,
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
      fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
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
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
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
      fontFamily: "'JetBrains Mono', ui-monospace, monospace",
      fontSize: "0.78125rem",
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
          backgroundColor: neutral[950],
          scrollbarColor: `${neutral[700]} transparent`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 12,
          border: `1px solid ${neutral[700]}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: neutral[900],
          borderRight: `1px solid ${neutral[700]}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: neutral[900],
          backgroundImage: "none",
          borderBottom: `1px solid ${neutral[700]}`,
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);
