import { Box, Button, Typography } from "@mui/material";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PARENTAL_CONTROLS_ENABLED } from "../../config/featureFlags";
import { whiteAlpha } from "../../theme/tokens";
import { useParentalUnlock } from "../parental/useParentalUnlock";
import { AuthShell } from "./AuthShell";

/**
 * Full-page lock shown by ``RequireAdmin`` when ``/users/me`` reports
 * ``admin_access: "suspended"``: the account is an administrator, but
 * the session is under an age-limited profile (ADR-035).
 *
 * It renders on its own, never inside ``AdminLayout``, so none of the
 * admin shell's queries (sidebar review badges, page data, polling)
 * fire and collect 403s while authority is suspended.
 *
 * While ``PARENTAL_CONTROLS_ENABLED`` is on it offers "Unlock with PIN":
 * the PIN challenge unlocks this device, ``useUnlockParental`` refetches
 * ``/users/me``, and once ``admin_access`` comes back ``"granted"``
 * ``RequireAdmin`` renders the admin routes in place of this screen.
 * There is no gated request to retry here, so it opens the challenge
 * with ``unlock()`` rather than ``run(fn)``.
 */
export function AdminLockedScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { unlock } = useParentalUnlock();

  const handleUnlock = () => {
    // ``unlock()`` only rejects when the challenge is closed (a wrong PIN or
    // a lock stays inside the dialog), which keeps this screen as it is.
    unlock().catch(() => {});
  };

  return (
    <AuthShell>
      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 2,
          px: 3,
        }}
      >
        <Box
          aria-hidden
          sx={{
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: `1px solid ${whiteAlpha(0.15)}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "primary.main",
          }}
        >
          <Lock size={28} />
        </Box>
        <Typography variant="h1" sx={{ fontSize: { xs: "1.5rem", sm: "1.9rem" }, fontWeight: 400 }}>
          {t("admin.locked.title")}
        </Typography>
        <Typography color="text.secondary" sx={{ maxWidth: 480 }}>
          {t(PARENTAL_CONTROLS_ENABLED ? "admin.locked.bodyWithPin" : "admin.locked.body")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
          {PARENTAL_CONTROLS_ENABLED && (
            <Button variant="contained" onClick={handleUnlock}>
              {t("admin.locked.unlock")}
            </Button>
          )}
          <Button variant="outlined" onClick={() => navigate("/profiles")}>
            {t("admin.locked.switchProfile")}
          </Button>
          <Button color="inherit" onClick={() => navigate("/", { replace: true })}>
            {t("admin.locked.backHome")}
          </Button>
        </Box>
      </Box>
    </AuthShell>
  );
}
