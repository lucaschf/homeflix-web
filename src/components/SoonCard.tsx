import { Box, ButtonBase, Typography } from "@mui/material";
import { Bell, BellRing } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CatalogRequest } from "../api/types";
import { peach } from "../theme/colors";
import {
  fontFamily,
  fontSize,
  inkAlpha,
  peachAlpha,
  scrim,
  whiteAlpha,
} from "../theme/tokens";

// Fallback poster-gradient seeds for rows that have no snapshot yet.
const TONES = ["#3a2f4a", "#2f3a4a", "#4a3a2f", "#2f4a3a", "#4a2f3f", "#2f444a"];

function initialsFor(title: string | null): string {
  if (!title) return "?";
  return title
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

interface SoonCardProps {
  request: CatalogRequest;
  pending?: boolean;
  /** Toggle the caller's "notify on arrival" subscription. */
  onToggle: () => void;
}

/**
 * One title on the "Em breve" grid — the standard poster treatment
 * (2:3, hover lift) over the snapshot ``poster_url``, falling back to a
 * serif-initials placeholder when no poster was captured yet. The core
 * affordance is the per-title "Avisar quando chegar" toggle plus the
 * "N people waiting" social proof.
 */
export function SoonCard({ request, pending = false, onToggle }: SoonCardProps) {
  const { t } = useTranslation();
  const subscribed = request.is_subscribed ?? false;
  const count = request.subscriber_count ?? 0;
  const tone = TONES[request.tmdb_id % TONES.length];

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
      <Box
        sx={{
          position: "relative",
          aspectRatio: "2 / 3",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          border: `1px solid ${subscribed ? peachAlpha(0.55) : whiteAlpha(0.06)}`,
          boxShadow: subscribed
            ? `0 0 0 1px ${peachAlpha(0.2)}, 0 8px 24px ${peachAlpha(0.12)}`
            : "none",
          transition: "border-color 180ms ease",
          "&:hover .soon-poster": { transform: "scale(1.05)" },
        }}
      >
        {request.poster_url ? (
          <Box
            component="img"
            className="soon-poster"
            src={request.poster_url}
            alt={request.title ?? ""}
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 250ms ease",
            }}
          />
        ) : (
          <Box
            aria-hidden
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(160deg, ${tone}, #0a0a0a)`,
              fontFamily: "Georgia, serif",
              fontSize: 56,
              color: whiteAlpha(0.16),
            }}
          >
            {initialsFor(request.title)}
          </Box>
        )}

        <Box
          sx={{
            position: "absolute",
            top: 8,
            left: 8,
            px: 0.75,
            py: 0.25,
            borderRadius: "4px",
            bgcolor: scrim(0.6),
            backdropFilter: "blur(6px)",
            fontFamily: fontFamily.mono,
            fontSize: fontSize.micro,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: inkAlpha(0.85),
          }}
        >
          {t(`comingSoon.kind.${request.media_type}`)}
        </Box>

        {subscribed && (
          <Box
            sx={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 22,
              height: 22,
              borderRadius: "50%",
              bgcolor: peach.main,
              color: "#0A0A0A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <BellRing size={12} aria-hidden />
          </Box>
        )}

        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            px: 1,
            pt: 3,
            pb: 0.75,
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            background: `linear-gradient(to top, ${scrim(0.75)}, transparent)`,
            fontFamily: fontFamily.mono,
            fontSize: fontSize.micro,
            color: inkAlpha(0.85),
          }}
        >
          <Box sx={{ width: 5, height: 5, borderRadius: "50%", bgcolor: peach.main }} />
          {t(`comingSoon.status.${request.status}`)}
        </Box>
      </Box>

      <Typography
        variant="body1"
        sx={{
          fontWeight: 600,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {request.title ?? t("comingSoon.untitled")}
      </Typography>

      <ButtonBase
        onClick={onToggle}
        disabled={pending}
        sx={{
          width: "100%",
          borderRadius: "8px",
          py: 1.15,
          px: 1.5,
          gap: 0.75,
          fontSize: fontSize.control,
          fontWeight: 600,
          whiteSpace: "nowrap",
          transition: "background-color 140ms ease",
          ...(subscribed
            ? {
                bgcolor: peachAlpha(0.12),
                color: peach.main,
                border: `1px solid ${peachAlpha(0.4)}`,
                "&:hover": { bgcolor: peachAlpha(0.18) },
              }
            : {
                bgcolor: peach.main,
                color: "#0A0A0A",
                border: "1px solid transparent",
                "&:hover": { filter: "brightness(0.95)" },
              }),
          "&.Mui-disabled": { opacity: 0.6 },
        }}
      >
        {subscribed ? <BellRing size={14} aria-hidden /> : <Bell size={14} aria-hidden />}
        {t(subscribed ? "comingSoon.card.subscribed" : "comingSoon.card.subscribe")}
      </ButtonBase>

      <Typography variant="caption" sx={{ color: "text.secondary", textAlign: "center" }}>
        {count > 0
          ? t("comingSoon.card.waiting", { count })
          : t("comingSoon.card.beFirst")}
      </Typography>
    </Box>
  );
}
