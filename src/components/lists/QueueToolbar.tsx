import { Box, Typography } from "@mui/material";
import { Clock, Play, Shuffle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AdminButton } from "../admin/AdminButton";
import { SortMenuButton } from "./SortMenuButton";

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

  const sortOptions = [
    { key: "recent" as const, label: t("lists.sortRecent") },
    { key: "title" as const, label: t("lists.sortTitle") },
  ];

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
        <SortMenuButton
          label={t("lists.sortLabel")}
          value={sort}
          options={sortOptions}
          onChange={onSortChange}
        />

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
