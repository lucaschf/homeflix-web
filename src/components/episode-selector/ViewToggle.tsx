import { Box } from "@mui/material";
import { GalleryHorizontalEnd, LayoutList } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { EpisodeSelectorView } from "../../hooks/useEpisodeSelector";
import { inkAlpha, peachAlpha, whiteAlpha } from "../../theme/tokens";

interface ViewToggleProps {
  value: EpisodeSelectorView;
  onChange: (view: EpisodeSelectorView) => void;
  /** Icon-only, for the narrow rail header on small screens. */
  compact?: boolean;
}

/**
 * Lista ⇄ Carrossel switch. Ships as a real in-page control (not a
 * design-time option): the two presentations suit different inputs —
 * list for mouse/keyboard and long seasons, carousel for touch/TV —
 * and the choice sticks per profile.
 */
export function ViewToggle({ value, onChange, compact = false }: ViewToggleProps) {
  const { t } = useTranslation();

  const options = [
    { view: "list" as const, label: t("player.episodeSelector.viewList"), Icon: LayoutList },
    { view: "rail" as const, label: t("player.episodeSelector.viewRail"), Icon: GalleryHorizontalEnd },
  ];

  return (
    <Box
      role="group"
      aria-label={t("player.episodeSelector.viewLabel")}
      sx={{
        display: "inline-flex",
        gap: "2px",
        p: "3px",
        flexShrink: 0,
        borderRadius: "9px",
        bgcolor: whiteAlpha(0.06),
        border: `1px solid ${whiteAlpha(0.08)}`,
      }}
    >
      {options.map(({ view, label, Icon }) => {
        const active = view === value;
        return (
          <Box
            key={view}
            component="button"
            type="button"
            onClick={() => onChange(view)}
            title={label}
            aria-pressed={active}
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "7px",
              px: compact ? "8px" : "11px",
              py: "6px",
              border: "none",
              borderRadius: "6px",
              font: "inherit",
              fontSize: 12,
              fontWeight: active ? 600 : 500,
              bgcolor: active ? peachAlpha(0.18) : "transparent",
              color: active ? "primary.main" : inkAlpha(0.55),
              transition: "background 120ms, color 120ms",
              "&:hover": { color: active ? "primary.main" : inkAlpha(0.8) },
            }}
          >
            <Icon size={14} />
            {!compact && label}
          </Box>
        );
      })}
    </Box>
  );
}
