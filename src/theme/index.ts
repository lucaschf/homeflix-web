import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { error, info, neutral, peach, success, warning } from "./colors";

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
//   carry the responsive font sizes (xs/md ≥ 900px) used by the player heading
//   row, so each Typography stays a single line of JSX.

declare module "@mui/material/styles" {
  interface Palette {
    overlayText: {
      primary: string;
      secondary: string;
    };
  }
  interface PaletteOptions {
    overlayText?: {
      primary: string;
      secondary: string;
    };
  }
  interface TypographyVariants {
    overlayTitle: React.CSSProperties;
    overlaySubtitle: React.CSSProperties;
    overlayTimestamp: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    overlayTitle?: React.CSSProperties;
    overlaySubtitle?: React.CSSProperties;
    overlayTimestamp?: React.CSSProperties;
  }
}

declare module "@mui/material/Typography" {
  interface TypographyPropsVariantOverrides {
    overlayTitle: true;
    overlaySubtitle: true;
    overlayTimestamp: true;
  }
}

const OVERLAY_TEXT_PRIMARY = "#FFFFFF";
const OVERLAY_TEXT_SECONDARY = "rgba(255, 255, 255, 0.7)";
// 900px is MUI's default `md` breakpoint, matching what the migrated inline
// `{ xs: ..., md: ... }` fontSize literals were resolving to before.
const OVERLAY_BREAKPOINT_MD = "@media (min-width:900px)";

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
          primary: neutral[50],
          secondary: neutral[400],
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
    h1: { fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: "1.375rem", fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "0.875rem", lineHeight: 1.5 },
    body2: { fontSize: "0.75rem", lineHeight: 1.5 },
    caption: { fontSize: "0.6875rem", fontWeight: 500, lineHeight: 1.4 },
    button: { textTransform: "none", fontWeight: 600 },
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
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
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
