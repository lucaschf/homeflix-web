import { Box, Typography } from "@mui/material";
import { Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { QualityChip, type QualityChipKind } from "../QualityChip";
import { fontFamily, inkAlpha, scrim, whiteAlpha } from "../../theme/tokens";

export interface QueueCardItem {
  media_id: string;
  media_type: "movie" | "series";
  title: string;
  poster_path?: string | null;
  /** Rich fields below light up once the backend DTO is enriched (B1/B2).
   *  Each is rendered only when present, so the card degrades gracefully. */
  year?: number;
  /** Pre-formatted runtime, e.g. "2h02". */
  runtime?: string;
  genre?: string;
  /** Quality chip label, e.g. "4K HDR". */
  qualityLabel?: string;
  qualityKind?: QualityChipKind;
  /** Playback progress in ``[0, 1]``. */
  progress?: number;
}

interface QueueCardProps {
  item: QueueCardItem;
  /** Zero-based position in the queue; rendered 1-based + zero-padded. */
  index: number;
  onOpen: () => void;
  onPlay: () => void;
  onRemove: () => void;
}

/**
 * Poster card for a single "Fila" (watch-later queue) entry. Shows a
 * queue-position badge and a hover overlay with play + remove. Quality
 * chip, meta line and progress bar render only when the (optional) rich
 * fields are present, so the same card works before and after the
 * backend DTO enrichment.
 */
export function QueueCard({ item, index, onOpen, onPlay, onRemove }: QueueCardProps) {
  const { t } = useTranslation();
  const inProgress = item.progress != null && item.progress > 0 && item.progress < 1;
  const hasMeta = item.year != null || !!item.runtime || !!item.genre;

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <Box
      onClick={onOpen}
      sx={{
        cursor: "pointer",
        "&:hover .qc-overlay": { opacity: 1 },
        "&:hover .qc-fade": { opacity: 0 },
      }}
    >
      <Box
        sx={{
          position: "relative",
          aspectRatio: "2 / 3",
          borderRadius: 2,
          overflow: "hidden",
          border: `1px solid ${whiteAlpha(0.08)}`,
          backgroundColor: "background.default",
          ...(item.poster_path
            ? {
                backgroundImage: `url(${item.poster_path})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : {}),
        }}
      >
        {!item.poster_path && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 1.75,
              textAlign: "center",
              fontFamily: "serif",
              fontWeight: 700,
              fontSize: "1.05rem",
              letterSpacing: "0.05em",
              color: inkAlpha(0.85),
            }}
          >
            {item.title.toUpperCase()}
          </Box>
        )}

        {/* quality chip */}
        {item.qualityLabel && (
          <Box
            className="qc-fade"
            sx={{ position: "absolute", top: 8, left: 8, transition: "opacity 150ms" }}
          >
            <QualityChip label={item.qualityLabel} kind={item.qualityKind ?? "neutral"} size="sm" />
          </Box>
        )}

        {/* queue position */}
        <Box
          className="qc-fade"
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            width: 24,
            height: 24,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: scrim(0.7),
            backdropFilter: "blur(4px)",
            border: `1px solid ${whiteAlpha(0.14)}`,
            fontFamily: fontFamily.mono,
            fontSize: 11,
            fontWeight: 600,
            color: "text.primary",
            transition: "opacity 150ms",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </Box>

        {/* hover overlay */}
        <Box
          className="qc-overlay"
          sx={{
            position: "absolute",
            inset: 0,
            opacity: 0,
            transition: "opacity 200ms",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            p: 1.25,
            background: `linear-gradient(180deg, ${scrim(0.55)} 0%, ${scrim(0.15)} 40%, ${scrim(0.92)} 100%)`,
          }}
        >
          <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
            <IconChip title={t("lists.removeFromQueue")} onClick={stop(onRemove)}>
              <X size={13} />
            </IconChip>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <IconChip title={t("lists.play")} onClick={stop(onPlay)} peach>
              <Play size={16} fill="currentColor" />
            </IconChip>
            <Typography
              sx={{
                fontFamily: fontFamily.mono,
                fontSize: 11,
                color: inkAlpha(0.85),
              }}
            >
              {inProgress
                ? t("lists.percentWatched", { percent: Math.round((item.progress ?? 0) * 100) })
                : item.runtime}
            </Typography>
          </Box>
        </Box>

        {/* progress bar */}
        {inProgress && (
          <Box sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3, bgcolor: scrim(0.55) }}>
            <Box sx={{ width: `${(item.progress ?? 0) * 100}%`, height: "100%", bgcolor: "primary.main" }} />
          </Box>
        )}
      </Box>

      <Box sx={{ mt: 1.25 }}>
        <Typography
          sx={{
            fontSize: "0.84rem",
            fontWeight: 500,
            letterSpacing: "-0.01em",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {item.title}
        </Typography>
        {hasMeta && (
          <Box
            sx={{
              mt: 0.4,
              display: "flex",
              gap: 0.9,
              alignItems: "center",
              fontFamily: fontFamily.mono,
              fontSize: 11,
              color: "text.secondary",
            }}
          >
            {[item.year, item.runtime, item.genre]
              .filter(Boolean)
              .map((part, i, arr) => (
                <Box key={i} component="span" sx={{ display: "inline-flex", gap: 0.9 }}>
                  <span>{part}</span>
                  {i < arr.length - 1 && <span style={{ opacity: 0.4 }}>·</span>}
                </Box>
              ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

/** Small frosted icon button used inside the hover overlay. */
function IconChip({
  title,
  onClick,
  peach,
  children,
}: {
  title: string;
  onClick: (e: React.MouseEvent) => void;
  peach?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Box
      component="button"
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      sx={{
        width: peach ? 38 : 30,
        height: peach ? 38 : 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: peach ? "50%" : 1.75,
        cursor: "pointer",
        p: 0,
        transition: "transform 120ms, background-color 120ms",
        "&:hover": { transform: "scale(1.06)" },
        ...(peach
          ? { bgcolor: "primary.main", color: "primary.contrastText", border: "none" }
          : {
              bgcolor: scrim(0.6),
              backdropFilter: "blur(6px)",
              border: `1px solid ${whiteAlpha(0.18)}`,
              color: "text.primary",
            }),
      }}
    >
      {children}
    </Box>
  );
}
