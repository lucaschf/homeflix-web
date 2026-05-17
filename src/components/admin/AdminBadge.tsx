import { Box } from "@mui/material";
import type { ReactNode } from "react";

export type BadgeTone = "neutral" | "peach" | "ok" | "warn" | "err" | "info";

interface AdminBadgeProps {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
}

const TONE_STYLES: Record<BadgeTone, { bg: string; fg: string; bd: string }> = {
  neutral: {
    bg: "rgba(255,255,255,0.05)",
    fg: "rgba(245,241,235,0.7)",
    bd: "rgba(255,255,255,0.08)",
  },
  peach: {
    bg: "rgba(217,119,87,0.10)",
    fg: "#D97757",
    bd: "rgba(217,119,87,0.30)",
  },
  ok: {
    bg: "rgba(80,180,120,0.08)",
    fg: "#7adf9a",
    bd: "rgba(80,180,120,0.30)",
  },
  warn: {
    bg: "rgba(240,180,80,0.08)",
    fg: "#f5c46a",
    bd: "rgba(240,180,80,0.30)",
  },
  err: {
    bg: "rgba(220,80,70,0.08)",
    fg: "#ff8a7a",
    bd: "rgba(220,80,70,0.30)",
  },
  info: {
    bg: "rgba(100,150,220,0.08)",
    fg: "#8ab4f0",
    bd: "rgba(100,150,220,0.28)",
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
export function AdminBadge({ tone = "neutral", icon, children }: AdminBadgeProps) {
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
        fontFamily: "'JetBrains Mono', ui-monospace, monospace",
        fontSize: "0.625rem",
        letterSpacing: "0.10em",
        textTransform: "uppercase",
        color: t.fg,
        fontWeight: 500,
        lineHeight: 1.2,
      }}
    >
      {icon}
      {children}
    </Box>
  );
}
