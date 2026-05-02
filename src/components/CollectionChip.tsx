import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import type { CollectionOutput } from "../api/types";

interface CollectionChipProps {
  collection: CollectionOutput;
}

export function CollectionChip({ collection }: CollectionChipProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1,
        alignSelf: "flex-start",
        padding: "8px 14px 8px 12px",
        bgcolor: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: "20px",
        fontSize: "0.8125rem",
        color: "rgba(245,241,235,0.85)",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
      }}
    >
      <Box component="span" sx={{ fontSize: "0.8125rem", lineHeight: 1 }} aria-hidden>
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
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: "0.75rem",
        }}
      >
        · {t("detail.moviesCount", { count: collection.parts_count })}
      </Box>
      <Box component="span" sx={{ color: "primary.main", ml: 0.25 }}>
        →
      </Box>
    </Box>
  );
}
