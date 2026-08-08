import { Alert, Box, Button, Typography } from "@mui/material";
import { ArrowLeft } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

interface DetailErrorProps {
  /** i18n key for the heading; defaults to a generic "couldn't load". */
  titleKey?: string;
  /** i18n key for the body copy. */
  bodyKey?: string;
}

/**
 * Full-page error state for the detail screens. Shown when a title
 * can't be loaded (deleted, bad link, or a failed request) so the page
 * doesn't sit on an endless skeleton — it explains what happened and
 * offers a way back.
 */
export function DetailError({
  titleKey = "detail.errorTitle",
  bodyKey = "detail.errorBody",
}: DetailErrorProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box sx={{ maxWidth: 720, mx: "auto", mt: 12, px: 3 }}>
      <Alert severity="error" variant="outlined">
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          {t(titleKey)}
        </Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {t(bodyKey)}
        </Typography>
        <Button startIcon={<ArrowLeft size={16} />} onClick={() => navigate(-1)} sx={{ mt: 2 }}>
          {t("detail.back")}
        </Button>
      </Alert>
    </Box>
  );
}
