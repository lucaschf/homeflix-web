import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import type { CollectionOutput } from "../api/types";
import { fontFamily, fontSize, inkAlpha, peachAlpha, whiteAlpha } from "../theme/tokens";

interface CollectionChipProps {
  collection: CollectionOutput;
}

export function CollectionChip({ collection }: CollectionChipProps) {
  const { t } = useTranslation();

  return (
    <Box
      component={RouterLink}
      to={`/collection/${collection.tmdb_id}`}
      aria-label={`${t("detail.partOf")} ${collection.name}`}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        alignSelf: "flex-start",
        padding: "8px 14px 8px 12px",
        bgcolor: whiteAlpha(0.04),
        border: `1px solid ${whiteAlpha(0.08)}`,
        borderRadius: "20px",
        fontSize: fontSize.control,
        color: inkAlpha(0.85),
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        textDecoration: "none",
        cursor: "pointer",
        transition: "border-color 160ms ease, background-color 160ms ease, color 160ms ease",
        "&:hover": {
          bgcolor: peachAlpha(0.06),
          borderColor: peachAlpha(0.35),
          color: "text.primary",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 2,
        },
      }}
    >
      <Box component="span" sx={{ fontSize: fontSize.control, lineHeight: 1 }} aria-hidden>
        📚
      </Box>
      <Box component="span">
        {t("detail.partOf")}{" "}
        <Box component="strong" sx={{ fontWeight: 600, color: "text.primary" }}>
          {collection.name}
        </Box>
      </Box>
      <Box
        component="span"
        sx={{
          color: "text.secondary",
          fontFamily: fontFamily.mono,
          fontSize: "0.75rem",
        }}
      >
        · {t("detail.moviesCount", { count: collection.parts_count })}
      </Box>
      <Box component="span" sx={{ color: "primary.main", ml: 0.25 }} aria-hidden>
        →
      </Box>
    </Box>
  );
}
