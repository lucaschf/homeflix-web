import { useEffect, useRef } from "react";
import { Box } from "@mui/material";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { SeasonOutput } from "../../api/types";
import { fontFamily, inkAlpha, menuScrim, peachAlpha, whiteAlpha } from "../../theme/tokens";

interface SeasonSelectProps {
  seasons: SeasonOutput[];
  value: number;
  onChange: (seasonNumber: number) => void;
  /** Controlled so the surrounding surface can close it on Escape. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function seasonLabel(
  season: SeasonOutput,
  t: (key: string, options?: Record<string, unknown>) => string,
): string {
  return season.season_number === 0
    ? t("detail.specials")
    : t("player.episodeSelector.season", { number: season.season_number });
}

/**
 * Season picker as a dropdown rather than tabs — tabs stop scaling
 * somewhere around six seasons, and a 12-season show would push the
 * episode list off the panel.
 *
 * Hand-rolled instead of MUI's ``Menu``: the player runs fullscreen,
 * and a portal to ``document.body`` renders *outside* the fullscreen
 * element (invisible). Staying in the DOM subtree sidesteps that
 * entirely.
 */
export function SeasonSelect({ seasons, value, onChange, open, onOpenChange }: SeasonSelectProps) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const current = seasons.find((s) => s.season_number === value) ?? seasons[0];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) onOpenChange(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open, onOpenChange]);

  if (!current) return null;

  return (
    <Box ref={rootRef} sx={{ position: "relative", width: "100%" }}>
      <Box
        component="button"
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          width: "100%",
          px: "12px",
          py: "9px",
          borderRadius: "9px",
          border: `1px solid ${whiteAlpha(0.08)}`,
          bgcolor: whiteAlpha(0.03),
          color: "overlayText.primary",
          font: "inherit",
          fontSize: 13,
          fontWeight: 500,
          "&:hover": { bgcolor: whiteAlpha(0.06) },
        }}
      >
        <Box component="span" sx={{ flex: 1, textAlign: "left" }}>
          {seasonLabel(current, t)}
        </Box>
        <Box
          component="span"
          sx={{ fontFamily: fontFamily.mono, fontSize: 10.5, color: "text.secondary" }}
        >
          {t("player.episodeSelector.episodeCount", { count: current.episodes.length })}
        </Box>
        <Box
          component="span"
          sx={{
            display: "grid",
            color: "text.secondary",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 180ms",
          }}
        >
          <ChevronDown size={14} />
        </Box>
      </Box>

      {open && (
        <Box
          role="listbox"
          aria-label={t("player.episodeSelector.seasonLabel")}
          sx={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 30,
            maxHeight: 230,
            overflowY: "auto",
            p: "5px",
            borderRadius: "10px",
            border: `1px solid ${whiteAlpha(0.12)}`,
            bgcolor: menuScrim(0.98),
            backdropFilter: "blur(8px)",
            boxShadow: 6,
          }}
        >
          {seasons.map((season) => {
            const active = season.season_number === value;
            return (
              <Box
                key={season.season_number}
                component="button"
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(season.season_number);
                  onOpenChange(false);
                }}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  width: "100%",
                  px: "10px",
                  py: "8px",
                  border: "none",
                  borderRadius: "7px",
                  textAlign: "left",
                  font: "inherit",
                  fontSize: 12.5,
                  bgcolor: active ? peachAlpha(0.14) : "transparent",
                  color: active ? "primary.main" : "overlayText.primary",
                  "&:hover": { bgcolor: active ? peachAlpha(0.18) : whiteAlpha(0.06) },
                }}
              >
                <Box component="span" sx={{ flex: 1 }}>
                  {seasonLabel(season, t)}
                </Box>
                <Box
                  component="span"
                  sx={{ fontFamily: fontFamily.mono, fontSize: 10, color: inkAlpha(0.5) }}
                >
                  {season.episodes.length}
                </Box>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  );
}
