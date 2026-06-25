import { Box, Typography } from "@mui/material";
import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { peachAlpha, whiteAlpha } from "../../theme/tokens";

/**
 * Dashed ghost tile that closes the custom-lists grid and opens the
 * create-list dialog. Matches the 4:3 footprint of ``ListCard`` so it
 * tiles cleanly alongside real lists.
 */
export function CreateListCard({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        width: "100%",
        aspectRatio: "4 / 3",
        borderRadius: "10px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1.5,
        border: `1.5px dashed ${whiteAlpha(0.14)}`,
        bgcolor: whiteAlpha(0.015),
        color: "text.secondary",
        transition: "all 160ms",
        "&:hover": {
          borderColor: peachAlpha(0.6),
          bgcolor: peachAlpha(0.05),
          color: "text.primary",
          "& .clc-ring": { borderColor: "primary.main", color: "primary.main" },
        },
      }}
    >
      <Box
        className="clc-ring"
        sx={{
          width: 44,
          height: 44,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `1px solid ${whiteAlpha(0.18)}`,
          color: "text.secondary",
          transition: "all 160ms",
        }}
      >
        <Plus size={20} />
      </Box>
      <Typography sx={{ fontSize: "0.84rem", fontWeight: 500 }}>{t("lists.createNewList")}</Typography>
    </Box>
  );
}
