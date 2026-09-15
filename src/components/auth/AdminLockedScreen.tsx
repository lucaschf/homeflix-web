import { Box, Button, Typography } from "@mui/material";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { whiteAlpha } from "../../theme/tokens";
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
 * This is where the parental PIN challenge belongs: an unlock action
 * that, once it succeeds and ``/users/me`` comes back ``"granted"``,
 * lets ``RequireAdmin`` render the admin routes in its place. Until
 * then the screen only offers ways out.
 */
export function AdminLockedScreen() {
  const { t } = useTranslation();
  const navigate = useNavigate();

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
          {t("admin.locked.body")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap", justifyContent: "center" }}>
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
