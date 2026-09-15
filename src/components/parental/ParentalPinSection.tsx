import { useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../../api/auth";
import { inkAlpha, whiteAlpha } from "../../theme/tokens";
import { useToast } from "../ToastProvider";
import { ParentalPinSetupDialog, type ParentalPinSetupMode } from "./ParentalPinSetupDialog";

/**
 * The account's parental PIN on the profile-management screen: whether one
 * is set (``/users/me.parental_pin_configured``) and the actions to set,
 * change or remove it. Only rendered while ``PARENTAL_CONTROLS_ENABLED``
 * is on.
 */
export function ParentalPinSection() {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { data: currentUser } = useCurrentUser();
  const [mode, setMode] = useState<ParentalPinSetupMode | null>(null);
  const configured = currentUser?.parental_pin_configured === true;

  const handleDone = (done: ParentalPinSetupMode) => {
    setMode(null);
    showToast(t(done === "remove" ? "parental.setup.removed" : "parental.setup.saved"));
  };

  return (
    <Box
      component="section"
      aria-labelledby="parental-pin-section-title"
      sx={{
        width: "100%",
        maxWidth: 480,
        p: 2.5,
        borderRadius: 1,
        border: `1px solid ${whiteAlpha(0.12)}`,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
      }}
    >
      <Typography id="parental-pin-section-title" variant="h2" sx={{ fontSize: "1rem", fontWeight: 600 }}>
        {t("parental.setup.title")}
      </Typography>
      <Typography sx={{ fontSize: "0.8125rem", lineHeight: 1.55, color: inkAlpha(0.65) }}>
        {configured ? t("parental.setup.statusConfigured") : t("parental.setup.statusMissing")}
      </Typography>
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button variant="outlined" onClick={() => setMode(configured ? "change" : "set")}>
          {configured ? t("parental.setup.change") : t("parental.setup.set")}
        </Button>
        {configured && (
          <Button color="error" onClick={() => setMode("remove")}>
            {t("parental.setup.remove")}
          </Button>
        )}
      </Box>
      <ParentalPinSetupDialog mode={mode} onClose={() => setMode(null)} onDone={handleDone} />
    </Box>
  );
}
