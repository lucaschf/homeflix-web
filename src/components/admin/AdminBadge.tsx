import { Box } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ReactNode } from "react";
import { peach } from "../../theme/colors";
import { fontFamily, peachAlpha, status, whiteAlpha, inkAlpha } from "../../theme/tokens";

export type BadgeTone = "neutral" | "peach" | "ok" | "warn" | "err" | "info";

interface AdminBadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  /** Optional style overrides merged onto the pill (e.g. a larger
   *  ``fontSize`` for a specific surface). Left out of the tone
   *  palette so callers can't redefine the six semantic colors. */
  sx?: object;
}

const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
  neutral: {
    bg: whiteAlpha(0.05),
    fg: inkAlpha(0.7),
    bd: whiteAlpha(0.08),
  },
  peach: {
    bg: peachAlpha(0.1),
    fg: peach.main,
    bd: peachAlpha(0.3),
  },
  ok: {
    bg: alpha(status.ok.base, 0.08),
    fg: status.ok.fg,
    bd: alpha(status.ok.base, 0.3),
  },
  warn: {
    bg: alpha(status.warn.base, 0.08),
    fg: status.warn.fg,
    bd: alpha(status.warn.base, 0.3),
  },
  err: {
    bg: alpha(status.err.base, 0.08),
    fg: status.err.fg,
    bd: alpha(status.err.base, 0.3),
  },
  info: {
    bg: alpha(status.info.base, 0.08),
    fg: status.info.fg,
    bd: alpha(status.info.base, 0.28),
  },
};

/**
 * Status pill used in tables, page headers and stat cards. Six tones
 * cover the recurring states (neutral default, peach for catalog
 * accents, ok/warn/err/info for system health). Monospaced label so
 * counts and short codes stay aligned across rows.
 *
 * Distinct from MUI's ``Chip``: the badge is non-interactive (no
 * delete affordance, no click), smaller, and pinned to the design
 * spec's tone palette so consumers can't accidentally introduce a
 * seventh state.
 */
export function AdminBadge({ tone = "neutral", icon, children, sx }: AdminBadgeProps) {
  const t = TONE_STYLES[tone];
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        py: 0.25,
        px: 1,
        bgcolor: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: 999,
        fontFamily: fontFamily.mono,
        fontSize: "0.625rem",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: t.fg,
        fontWeight: 500,
        lineHeight: 1.2,
        ...sx,
      }}
    >
      {icon}
      {children}
    </Box>
  );
}
