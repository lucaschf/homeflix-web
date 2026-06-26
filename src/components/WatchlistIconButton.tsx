import { IconButton, Tooltip } from "@mui/material";
import { Bookmark } from "lucide-react";
import { ACTION_BAR_HEIGHT, border, whiteAlpha } from "../theme/tokens";

interface WatchlistIconButtonProps {
  /** Whether the title is already in the watchlist (filled, coral). */
  active: boolean;
  onClick: () => void;
  /** Tooltip when not yet in the list. */
  addLabel: string;
  /** Tooltip when already in the list. */
  removeLabel: string;
}

/**
 * Square bookmark toggle for the detail action bar. Sized to
 * ``ACTION_BAR_HEIGHT`` with the canonical hairline border (ADR-001) so it
 * lines up exactly with the Watch / Trailer buttons beside it. Previously the
 * movie and series detail pages hardcoded divergent sizes (46×46 r8 vs
 * 38×38 r12), which read as a ragged action row.
 */
export function WatchlistIconButton({
  active,
  onClick,
  addLabel,
  removeLabel,
}: WatchlistIconButtonProps) {
  return (
    <Tooltip title={active ? removeLabel : addLabel} arrow>
      <IconButton
        onClick={onClick}
        aria-label={active ? removeLabel : addLabel}
        sx={{
          width: ACTION_BAR_HEIGHT,
          height: ACTION_BAR_HEIGHT,
          borderRadius: 1, // 8px — canonical control radius (shape.borderRadius)
          color: active ? "primary.main" : "text.primary",
          bgcolor: whiteAlpha(0.04),
          border: "1px solid",
          borderColor: active ? "primary.main" : border.hairline,
          "&:hover": {
            bgcolor: whiteAlpha(0.07),
            borderColor: active ? "primary.main" : border.hairlineStrong,
          },
        }}
      >
        <Bookmark size={18} fill={active ? "currentColor" : "none"} />
      </IconButton>
    </Tooltip>
  );
}
