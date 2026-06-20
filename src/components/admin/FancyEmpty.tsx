import { Box, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { peach } from "../../theme/colors";
import { AdminBadge, type BadgeTone } from "./AdminBadge";
import { inkAlpha, peachAlpha, whiteAlpha } from "../../theme/tokens";

export type EmptyMotif = "rows" | "cards" | "orbit";

interface FancyEmptyProps {
  /** Lucide icon shown inside the seal. */
  icon: LucideIcon;
  /** Background illustration behind the seal. */
  motif?: EmptyMotif;
  title: ReactNode;
  body?: ReactNode;
  /** Optional context badge. */
  badge?: ReactNode;
  badgeTone?: BadgeTone;
  /** Optional mono uppercase meta string. */
  meta?: ReactNode;
  /** Optional primary CTA. */
  primary?: ReactNode;
  /** Optional secondary CTA (lateral escape). */
  secondary?: ReactNode;
  /**
   * Draw the hairline frame + surface fill. On by default so the empty
   * reads as a framed box when it replaces table rows. Set ``false``
   * when the empty already sits inside an ``AdminCard`` to avoid a
   * redundant nested border.
   */
  framed?: boolean;
}

/**
 * Polished empty-state used across admin tables/lists when there are no
 * rows. A faint motif sits behind a peach "seal" with a pulsing ring,
 * topped by a scanline rule, with action-oriented copy and optional
 * context line + CTAs.
 *
 * Replaces the plain dashed-box ``AdminEmptyState`` on surfaces that
 * warrant a richer "nothing here" affordance (see
 * ``specs/empty-state-spec.md``). Decorative bits (scanline, motif,
 * seal) are ``aria-hidden``; the title is the only heading.
 */
export function FancyEmpty({
  icon: Icon,
  motif = "rows",
  title,
  body,
  badge,
  badgeTone = "ok",
  meta,
  primary,
  secondary,
  framed = true,
}: FancyEmptyProps) {
  const showContext = Boolean(badge || meta);
  const showCta = Boolean(primary || secondary);

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: "10px",
        overflow: "hidden",
        ...(framed && {
          border: `1px solid ${whiteAlpha(0.08)}`,
          bgcolor: whiteAlpha(0.015),
        }),
        backgroundImage: `radial-gradient(ellipse 480px 240px at 50% 6%, ${peachAlpha(0.06)}, transparent 70%)`,
        px: 3,
        pt: "52px",
        pb: "48px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      {/* Top scanline */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${peachAlpha(0.45)}, transparent)`,
        }}
      />

      {/* Motif + seal composition */}
      <Box
        aria-hidden
        sx={{
          position: "relative",
          width: 200,
          height: 96,
          mb: 2.5,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Motif motif={motif} />
        <Seal Icon={Icon} />
      </Box>

      <Typography
        component="h3"
        sx={{
          fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
          fontWeight: 600,
          fontSize: "19px",
          letterSpacing: "-0.02em",
          color: inkAlpha(1),
          m: 0,
        }}
      >
        {title}
      </Typography>

      {body && (
        <Typography
          component="p"
          sx={{
            mt: 1,
            fontSize: "13px",
            lineHeight: 1.6,
            color: inkAlpha(0.55),
            maxWidth: 360,
          }}
        >
          {body}
        </Typography>
      )}

      {showContext && (
        <Box
          sx={{
            mt: 2,
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {badge && <AdminBadge tone={badgeTone}>{badge}</AdminBadge>}
          {meta && (
            <Box
              component="span"
              sx={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: "10.5px",
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "text.secondary",
              }}
            >
              {meta}
            </Box>
          )}
        </Box>
      )}

      {showCta && (
        <Box sx={{ mt: 3, display: "flex", gap: 1.25, flexWrap: "wrap", justifyContent: "center" }}>
          {primary}
          {secondary}
        </Box>
      )}
    </Box>
  );
}

/** 60×60 peach seal with a pulsing ring holding the lucide icon. */
function Seal({ Icon }: { Icon: LucideIcon }) {
  return (
    <Box
      sx={{
        position: "relative",
        width: 60,
        height: 60,
        borderRadius: "16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: `linear-gradient(160deg, ${peachAlpha(0.22)}, ${peachAlpha(0.06)})`,
        border: `1px solid ${peachAlpha(0.45)}`,
        boxShadow: `0 12px 36px ${peachAlpha(0.25)}, inset 0 1px 0 ${whiteAlpha(0.1)}`,
      }}
    >
      <Box
        component="span"
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: "16px",
          "@media (prefers-reduced-motion: no-preference)": {
            animation: "rq-pulse 2.6s ease-out infinite",
          },
          "@keyframes rq-pulse": {
            "0%": { boxShadow: `0 0 0 0 ${peachAlpha(0.35)}` },
            "70%": { boxShadow: `0 0 0 16px ${peachAlpha(0)}` },
            "100%": { boxShadow: `0 0 0 0 ${peachAlpha(0)}` },
          },
        }}
      />
      <Icon size={26} strokeWidth={1.9} color={peach.main} />
    </Box>
  );
}

/** Faint background illustration behind the seal — decorative only. */
function Motif({ motif }: { motif: EmptyMotif }) {
  const base = {
    position: "absolute" as const,
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };

  if (motif === "cards") {
    const cards = [
      { rotate: -9, width: 84 },
      { rotate: 8, width: 84 },
      { rotate: -4, width: 96 },
    ];
    return (
      <Box sx={base}>
        {cards.map((c, i) => (
          <Box
            key={i}
            sx={{
              position: "absolute",
              width: c.width,
              height: c.width * 1.4,
              borderRadius: "8px",
              border: `1px solid ${whiteAlpha(0.1)}`,
              bgcolor: whiteAlpha(0.03),
              opacity: 0.18 + i * 0.06,
              transform: `rotate(${c.rotate}deg) translateX(${(i - 1) * 26}px)`,
            }}
          />
        ))}
      </Box>
    );
  }

  if (motif === "orbit") {
    return (
      <Box sx={base}>
        {[150, 110].map((d) => (
          <Box
            key={d}
            sx={{
              position: "absolute",
              width: d,
              height: d,
              borderRadius: "50%",
              border: `1px dashed ${whiteAlpha(0.1)}`,
            }}
          />
        ))}
      </Box>
    );
  }

  // rows (default) — 3 stacked ghost list-rows, each fading.
  return (
    <Box sx={{ ...base, flexDirection: "column", gap: 1 }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            width: 168,
            opacity: 0.55 * (1 - i * 0.28),
          }}
        >
          <Box sx={{ width: 22, height: 22, borderRadius: "4px", bgcolor: whiteAlpha(0.08) }} />
          <Box sx={{ flex: 1, display: "flex", flexDirection: "column", gap: 0.5 }}>
            <Box sx={{ height: 6, borderRadius: 999, bgcolor: whiteAlpha(0.08), width: "70%" }} />
            <Box sx={{ height: 6, borderRadius: 999, bgcolor: whiteAlpha(0.05), width: "45%" }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}
