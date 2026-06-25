import { useState } from "react";
import { Box, Menu, MenuItem, Typography } from "@mui/material";
import { ChevronDown, Clock, Play, Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminButton } from "../admin/AdminButton";
import { fontFamily, fontSize, whiteAlpha } from "../../theme/tokens";

export type QueueSort = "recent" | "title";

interface QueueToolbarProps {
  /** Pre-formatted total runtime (e.g. "16h08"); hidden until available. */
  totalRuntime?: string;
  sort: QueueSort;
  onSortChange: (sort: QueueSort) => void;
  onShuffle: () => void;
  onPlayQueue: () => void;
  disabled?: boolean;
}

/**
 * Toolbar above the "Fila" grid: total runtime (when known), a sort
 * dropdown, a shuffle toggle and the primary "play queue" action.
 */
export function QueueToolbar({
  totalRuntime,
  sort,
  onSortChange,
  onShuffle,
  onPlayQueue,
  disabled,
}: QueueToolbarProps) {
  const { t } = useTranslation();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const sortLabels: Record<QueueSort, string> = {
    recent: t("lists.sortRecent"),
    title: t("lists.sortTitle"),
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 1.75,
        mb: 2.75,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.9, color: "text.secondary", minHeight: 36 }}>
        {totalRuntime && (
          <>
            <Clock size={15} />
            <Typography sx={{ fontSize: "0.82rem" }}>
              {t("lists.queueRuntime", { time: totalRuntime })}
            </Typography>
          </>
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
        {/* sort dropdown */}
        <Box
          component="button"
          type="button"
          onClick={(e) => setAnchor(e.currentTarget as HTMLElement)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1.5,
            py: 1,
            cursor: "pointer",
            borderRadius: 1.75,
            bgcolor: whiteAlpha(0.04),
            border: `1px solid ${whiteAlpha(0.08)}`,
            color: "text.secondary",
            "&:hover": { bgcolor: whiteAlpha(0.07) },
          }}
        >
          <Box
            component="span"
            sx={{
              fontFamily: fontFamily.mono,
              fontSize: fontSize.micro,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              opacity: 0.7,
            }}
          >
            {t("lists.sortLabel")}
          </Box>
          <Box component="span" sx={{ color: "text.primary", fontSize: fontSize.control, whiteSpace: "nowrap" }}>
            {sortLabels[sort]}
          </Box>
          <ChevronDown size={13} />
        </Box>
        <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
          {(Object.keys(sortLabels) as QueueSort[]).map((key) => (
            <MenuItem
              key={key}
              selected={key === sort}
              onClick={() => {
                onSortChange(key);
                setAnchor(null);
              }}
            >
              {sortLabels[key]}
            </MenuItem>
          ))}
        </Menu>

        <AdminButton
          variant="secondary"
          icon={<Shuffle size={15} />}
          onClick={onShuffle}
          disabled={disabled}
        >
          {t("lists.shuffle")}
        </AdminButton>
        <AdminButton
          variant="primary"
          icon={<Play size={13} fill="currentColor" />}
          onClick={onPlayQueue}
          disabled={disabled}
        >
          {t("lists.playQueue")}
        </AdminButton>
      </Box>
    </Box>
  );
}
