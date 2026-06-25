import { useState } from "react";
import { Box, Menu, MenuItem, Typography } from "@mui/material";
import { MoreVertical, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCustomListItems } from "../../api/hooks";
import type { CustomListOutput } from "../../api/types";
import { formatRelativeServerTime } from "../../utils/datetime";
import { fontFamily, scrim, whiteAlpha } from "../../theme/tokens";

interface ListCardProps {
  list: CustomListOutput;
  onOpen: () => void;
  onPlay: () => void;
  onRename: () => void;
  onDelete: () => void;
}

/**
 * Custom-list card: a 2×2 poster collage of the list's first four items
 * with a count badge and hover actions (play + options menu).
 *
 * The collage is built from a per-card ``useCustomListItems`` fetch for
 * now; once the list DTO carries ``poster_paths`` (B2) this can read them
 * directly and drop the extra query.
 */
export function ListCard({ list, onOpen, onPlay, onRename, onDelete }: ListCardProps) {
  const { t, i18n } = useTranslation();
  const { data: items } = useCustomListItems(list.id);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const posters = (items ?? [])
    .map((it) => it.poster_path)
    .filter((p): p is string => !!p)
    .slice(0, 4);

  const updated = formatRelativeServerTime(list.updated_at, i18n.language);

  const stop = (fn: () => void) => (e: React.MouseEvent) => {
    e.stopPropagation();
    fn();
  };

  return (
    <>
    <Box
      onClick={onOpen}
      sx={{
        cursor: "pointer",
        "&:hover .lc-thumb": { borderColor: whiteAlpha(0.18), transform: "translateY(-2px)" },
        "&:hover .lc-actions": { opacity: 1 },
      }}
    >
      <Box
        className="lc-thumb"
        sx={{
          position: "relative",
          aspectRatio: "4 / 3",
          borderRadius: "10px",
          overflow: "hidden",
          border: `1px solid ${whiteAlpha(0.08)}`,
          bgcolor: "background.default",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gridTemplateRows: "1fr 1fr",
          gap: "2px",
          transition: "border-color 160ms, transform 160ms",
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              bgcolor: whiteAlpha(0.03),
              ...(posters[i]
                ? {
                    backgroundImage: `url(${posters[i]})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }
                : {}),
            }}
          />
        ))}

        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, transparent 30%, ${scrim(0.55)} 70%, ${scrim(0.92)} 100%)`,
            pointerEvents: "none",
          }}
        />

        {/* count badge */}
        <Box
          sx={{
            position: "absolute",
            top: 10,
            left: 10,
            px: 1.1,
            py: 0.4,
            borderRadius: 20,
            bgcolor: scrim(0.66),
            backdropFilter: "blur(6px)",
            border: `1px solid ${whiteAlpha(0.12)}`,
            fontFamily: fontFamily.mono,
            fontSize: "0.66rem",
            color: "text.primary",
          }}
        >
          {t("lists.titlesCount", { count: list.item_count })}
        </Box>

        {/* hover actions */}
        <Box
          className="lc-actions"
          sx={{
            position: "absolute",
            top: 10,
            right: 10,
            display: "flex",
            gap: 0.75,
            opacity: 0,
            transition: "opacity 160ms",
          }}
        >
          <CollageChip title={t("lists.playList")} onClick={stop(onPlay)} peach>
            <Play size={13} fill="currentColor" />
          </CollageChip>
          <CollageChip
            title={t("lists.options")}
            onClick={(e) => {
              e.stopPropagation();
              setMenuAnchor(e.currentTarget as HTMLElement);
            }}
          >
            <MoreVertical size={14} />
          </CollageChip>
        </Box>
      </Box>

      <Box sx={{ mt: 1.5 }}>
        <Typography sx={{ fontSize: "0.92rem", fontWeight: 600, letterSpacing: "-0.01em" }}>
          {list.name}
        </Typography>
        {updated && (
          <Typography sx={{ mt: 0.4, fontSize: "0.72rem", color: "text.secondary" }}>
            {t("lists.updatedRelative", { time: updated })}
          </Typography>
        )}
      </Box>
    </Box>

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onRename();
          }}
        >
          {t("lists.rename")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            onDelete();
          }}
          sx={{ color: "error.main" }}
        >
          {t("lists.delete")}
        </MenuItem>
      </Menu>
    </>
  );
}

/** Frosted icon button overlaid on the collage. */
function CollageChip({
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
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 1.75,
        cursor: "pointer",
        p: 0,
        transition: "transform 120ms",
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
