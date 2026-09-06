import { alpha } from "@mui/material/styles";
import type { Theme } from "@mui/material/styles";
import {
  accentFor,
  fgFor,
  getScheme,
  neutral,
  neutralFor,
  panel2For,
  type ThemeScheme,
} from "./colors";

// Color tokens for values that recur as raw rgba()/hex literals across the UI.
//
// Each helper reproduces the *exact* same color it replaces, so swapping a
// literal for the matching token is visually a no-op — it just routes the
// value through one source of truth instead of being copy-pasted inline.
//
// Usage in `sx`:
//   bgcolor: whiteAlpha(0.08)                          // was "rgba(255,255,255,0.08)"
//   border: `1px solid ${whiteAlpha(0.08)}`            // was `1px solid rgba(255,255,255,0.08)`
//   color: status.err.fg                               // was "#ff8a7a"

// -- Alpha helpers (translucent fills, borders, scrims) -----------------------

/** White at `o` opacity — replaces `rgba(255,255,255,o)`. Hairlines, hovers and fills on dark surfaces. */
export const whiteAlpha = (o: number) => alpha("#FFFFFF", o);

/** Warm foreground (``--fg``) at `o`. Muted text/icons over dark. Follows the active scheme. */
export const inkAlpha = (o: number) => alpha(fgFor(getScheme()), o);

/** Pure-black scrim at `o` — replaces `rgba(0,0,0,o)`. Gradients and shadows over media. */
export const scrim = (o: number) => alpha("#000000", o);

/** Page-bg panel (neutral 950) at `o`. Translucent dark panels. Follows the active scheme. */
export const panelScrim = (o: number) => alpha(neutralFor(getScheme())[950], o);

/** Accent (peach in dark / amber in amber) at `o`. Primary-tinted fills and borders. */
export const peachAlpha = (o: number) => alpha(accentFor(getScheme()).main, o);

/** Frosted panel-2 surface at `o`. Translucent menu/popover panels (with `backdropFilter`) and raised hover surfaces. Follows the active scheme. */
export const menuScrim = (o: number) => alpha(panel2For(getScheme()), o);

// -- Type-scale steps used outside the `typography` variants -------------------
//
// `sx`-level font sizes that recur as raw rem literals on components that are
// NOT <Typography> (buttons, tabs, inputs, selects, menu items) — a typography
// `variant` can't reach those. Centralized here so the literal lives in one
// place; the `control` variant in the theme reads from the same constant.
export const fontSize = {
  /**
   * Compact control / field text. Sits between `body2` (0.75rem) and
   * `body1` (0.875rem) — the de-facto size for admin buttons, tabs, inputs,
   * selects and menu items. Pair with `fontWeight: 500` (600 when active).
   */
  control: "0.8125rem",
  /**
   * Small UI badge / eyebrow label — ~11-12px at the 19px root. Sits just
   * below the `caption` step (0.6875rem); used for notification meta, menu
   * eyebrows, count chips and other dense secondary labels.
   */
  badge: "0.625rem",
  /**
   * Smallest UI label — ~10px. Notification count badge, footer eyebrow.
   * Use sparingly; below this, text stops being comfortably legible.
   */
  micro: "0.5625rem",
} as const;

// -- Font-family stacks --------------------------------------------------------
//
// The canonical mono stack, declared once. Many components inlined a SHORTER
// copy (`'JetBrains Mono', ui-monospace, monospace`) that dropped
// `SFMono-Regular`; routing them through this token converges them on the full
// stack the theme's `eyebrow` variant already uses.
export const fontFamily = {
  /** Monospace stack — JetBrains Mono with SF Mono / generic fallbacks. */
  mono: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
} as const;

// -- Viewport height regimes ---------------------------------------------------
//
// Desktop layouts were tuned on 1080p+ monitors. A 1366×768 laptop has the
// same *width* breakpoint (``lg``) but ~30% less height, so the hero column
// spilled under the navbar and a poster card ate 60% of the screen. These
// helpers split desktop into "short" (< 960px tall) and "tall" (≥ 960px)
// so components can keep their original geometry on big screens and use a
// compact variant on laptops. Both are full ``@media`` strings usable as sx
// keys; pass the theme so the width part stays the real ``md`` breakpoint.

/** Viewport height (px) from which desktop keeps its original geometry. */
export const TALL_VIEWPORT_MIN_HEIGHT = 960;

/** ``@media`` for a desktop-width viewport shorter than ``TALL_VIEWPORT_MIN_HEIGHT``. */
export function shortDesktopViewport(theme: Theme): string {
  return `${theme.breakpoints.up("md")} and (max-height: ${TALL_VIEWPORT_MIN_HEIGHT - 1}px)`;
}

/** ``@media`` for a desktop-width viewport at least ``TALL_VIEWPORT_MIN_HEIGHT`` tall. */
export function tallDesktopViewport(theme: Theme): string {
  return `${theme.breakpoints.up("md")} and (min-height: ${TALL_VIEWPORT_MIN_HEIGHT}px)`;
}

// -- Control geometry ----------------------------------------------------------
//
// Canonical sizing + border treatment for the interactive controls that sit
// side-by-side in an action bar / toolbar (Button, IconButton, sort control).
// Centralized here so siblings share one vertical rhythm and one hairline
// instead of each call-site hardcoding its own `height` / `whiteAlpha(...)`.
// See ADR-001 (canonical control variants).

/**
 * Height of a hero action-bar control — the Watch / Trailer buttons and the
 * bookmark IconButton on a detail page. They must be identical so the row
 * doesn't read as ragged; the bookmark is a square of this size.
 */
export const ACTION_BAR_HEIGHT = 46;

/**
 * Hairline borders for "secondary / outlined" controls on dark surfaces. The
 * resting value matches the `hairline` Button variant; reach for these instead
 * of inlining `whiteAlpha(0.08)` / `whiteAlpha(0.12)` per call-site.
 */
export const border = {
  /** Resting hairline border. */
  hairline: whiteAlpha(0.08),
  /** Hover / emphasized hairline border. */
  hairlineStrong: whiteAlpha(0.12),
} as const;

// -- Admin status palette -----------------------------------------------------
//
// The admin surfaces share a status palette (see `AdminBadge`). Each tone has a
// light `fg` for text/icons and a saturated `base` used with `alpha()` for
// translucent fills and borders. Defined once here so pages stop re-deriving the
// same rgba()/hex literals inline.
//
//   bgcolor: alpha(status.err.base, 0.08)   // was "rgba(220,80,70,0.08)"
//   color: status.err.fg                    // was "#ff8a7a"

export interface StatusTone {
  /** Light foreground for text and icons. */
  fg: string;
  /** Saturated base for `alpha()` fills and borders. */
  base: string;
}

const BASE_STATUS = {
  ok: { fg: "#7ADF9A", base: "#50B478" }, // base = rgb(80,180,120)
  warn: { fg: "#F5C46A", base: "#F0B450" }, // base = rgb(240,180,80)
  err: { fg: "#FF8A7A", base: "#DC5046" }, // base = rgb(220,80,70)
  info: { fg: "#8AB4F0", base: "#6496DC" }, // base = rgb(100,150,220)
} satisfies Record<string, StatusTone>;

type StatusKey = keyof typeof BASE_STATUS;

// Mirror of ``WARNING_OVERRIDE`` in ``colors.ts`` for the admin badge / toast
// tone: the schemes whose accent lands on the gold warn hue get an orange one
// instead. See that table for the hue measurements and for why ``amber`` is
// deliberately not in this list. Every other scheme — and every other status
// tone — stays universal. Keep the two tables in step.
const ORANGE_WARN: StatusTone = { fg: "#FFB870", base: "#F08A32" };

const WARN_OVERRIDE: Partial<Record<ThemeScheme, StatusTone>> = {
  cyberyellow: ORANGE_WARN,
  prestige: ORANGE_WARN,
};

/**
 * Admin status tones. ``warn`` is resolved against the active scheme on every
 * access (same live-getter contract as ``neutral`` / ``peach`` in
 * ``colors.ts``), so read it at use time — don't hoist it into a module-level
 * constant or it will freeze to whichever theme was active at load.
 */
export const status = new Proxy({} as Record<StatusKey, StatusTone>, {
  get: (_target, prop) =>
    prop === "warn"
      ? (WARN_OVERRIDE[getScheme()] ?? BASE_STATUS.warn)
      : BASE_STATUS[prop as StatusKey],
});

// The admin "enrich / scan" gold. It happens to share the default ``warn``
// hex, but it is an accent rather than a status — so it is pinned here instead
// of aliasing ``status.warn.fg``, and it does NOT follow the override above.
const ADMIN_GOLD = "#F5C46A";

/** Gold `#F5C46A` at `o` — replaces `rgba(245,196,106,o)`. Amber fills in enrich/scan cards. */
export const goldAlpha = (o: number) => alpha(ADMIN_GOLD, o);

// -- Standalone accent foregrounds (used as solid hex, no alpha) ---------------

/** Admin accent coral — replaces bare `#FF8A7A` (identical to `status.err.fg`). */
export const accentCoral = status.err.fg;

/** Admin accent gold — replaces bare `#F5C46A` (see `ADMIN_GOLD`). */
export const accentGold = ADMIN_GOLD;

// -- Snackbar / toast surface -------------------------------------------------

export type ToastSeverity = "success" | "error" | "warning" | "info";

/**
 * Shared snackbar/toast surface. Matches the dashboard StatCard and the
 * dialog surface — solid ``neutral[950]`` base lifted by a flat 2.5% white
 * overlay — so every toast reads as the same raised panel as the rest of
 * the UI. Severity is carried by a tinted border instead of a full
 * background tint, which used to leave toasts colored (and inconsistent)
 * next to the neutral cards and dialogs. Spread into a toast's ``sx``;
 * callers keep their own radius/padding.
 */
export function toastSurfaceSx(severity: ToastSeverity) {
  const tone =
    severity === "error"
      ? status.err
      : severity === "warning"
        ? status.warn
        : severity === "info"
          ? status.info
          : status.ok;
  return {
    bgcolor: neutral[950],
    backgroundImage: `linear-gradient(${whiteAlpha(0.025)}, ${whiteAlpha(0.025)})`,
    border: `1px solid ${alpha(tone.base, 0.45)}`,
  };
}
