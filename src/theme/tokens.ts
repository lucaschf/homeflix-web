import { alpha } from "@mui/material/styles";
import { neutral, peach } from "./colors";

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

/** Warm foreground `#F5F1EB` at `o` — replaces `rgba(245,241,235,o)`. Muted text/icons over dark. */
export const inkAlpha = (o: number) => alpha("#F5F1EB", o);

/** Pure-black scrim at `o` — replaces `rgba(0,0,0,o)`. Gradients and shadows over media. */
export const scrim = (o: number) => alpha("#000000", o);

/** Near-black panel `#0D0D0D` (neutral 950) at `o` — replaces `rgba(13,13,13,o)`. Translucent dark panels. */
export const panelScrim = (o: number) => alpha(neutral[950], o);

/** Peach `#D97757` at `o` — replaces `rgba(217,119,87,o)`. Primary-tinted fills and borders. */
export const peachAlpha = (o: number) => alpha(peach.main, o);

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

export const status = {
  ok: { fg: "#7ADF9A", base: "#50B478" }, // base = rgb(80,180,120)
  warn: { fg: "#F5C46A", base: "#F0B450" }, // base = rgb(240,180,80)
  err: { fg: "#FF8A7A", base: "#DC5046" }, // base = rgb(220,80,70)
  info: { fg: "#8AB4F0", base: "#6496DC" }, // base = rgb(100,150,220)
} satisfies Record<string, StatusTone>;

/** Gold `#F5C46A` at `o` — replaces `rgba(245,196,106,o)`. Amber fills in enrich/scan cards. */
export const goldAlpha = (o: number) => alpha("#F5C46A", o);

// -- Standalone accent foregrounds (used as solid hex, no alpha) ---------------

/** Admin accent coral — replaces bare `#FF8A7A` (identical to `status.err.fg`). */
export const accentCoral = status.err.fg;

/** Admin accent gold — replaces bare `#F5C46A` (identical to `status.warn.fg`). */
export const accentGold = status.warn.fg;
