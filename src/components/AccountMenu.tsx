import { useState, type MouseEvent } from "react";
import {
  Box,
  Divider,
  IconButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
import { LogOut, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useLogout } from "../api/auth";
import { initialsForName } from "./auth/avatarUtils";

/**
 * Account dropdown surfaced in the right edge of the Navbar.
 *
 * The button shows a circular tile with the user's initials (the
 * avatar SVG / uploaded photo lands in a future PR — for now the
 * initials are the cheapest recognisable identity hint). Click
 * opens a menu with the user's email, a "switch profile" shortcut
 * back to ``/profiles``, and a sign-out item that fires
 * ``useLogout`` and bounces to ``/login``.
 *
 * Renders nothing while ``useCurrentUser`` is resolving or when the
 * caller is anonymous — in practice every Layout-wrapped page is
 * gated by ``RequireAuth`` upstream so the second branch is
 * defensive only.
 */
export function AccountMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: currentUser } = useCurrentUser();
  const logout = useLogout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!currentUser) return null;

  const initials = initialsForName(currentUser.email.split("@")[0] ?? currentUser.email);

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleSwitchProfile = () => {
    handleClose();
    navigate("/profiles");
  };

  const handleLogout = async () => {
    handleClose();
    try {
      await logout.mutateAsync();
    } finally {
      // Even if the network call fails, route to /login — the
      // RequireAuth guard will refetch ``/users/me`` and surface
      // any genuine "still authenticated" inconsistency by
      // redirecting back home.
      navigate("/login", { replace: true });
    }
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="small"
        aria-label={t("nav.account")}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        sx={{
          color: "text.primary",
          "&:hover": { bgcolor: "rgba(255, 255, 255, 0.04)" },
        }}
      >
        <Box
          sx={{
            width: 28,
            height: 28,
            borderRadius: "50%",
            bgcolor: "rgba(217, 119, 87, 0.12)",
            border: "1px solid rgba(217, 119, 87, 0.4)",
            color: "primary.light",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.02em",
          }}
        >
          {initials}
        </Box>
      </IconButton>
      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              minWidth: 220,
              bgcolor: "background.paper",
              border: "1px solid rgba(255, 255, 255, 0.08)",
            },
          },
        }}
      >
        {/* User identity row — non-interactive header */}
        <Box sx={{ px: 2, py: 1.25 }}>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              color: "text.secondary",
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {t("nav.account")}
          </Typography>
          <Typography
            sx={{
              fontSize: 13,
              fontWeight: 500,
              color: "text.primary",
              wordBreak: "break-all",
            }}
          >
            {currentUser.email}
          </Typography>
        </Box>
        <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.08)" }} />

        <MenuItem onClick={handleSwitchProfile}>
          <ListItemIcon sx={{ color: "text.secondary", minWidth: 32 }}>
            <Users size={16} />
          </ListItemIcon>
          {t("nav.switchProfile")}
        </MenuItem>

        <MenuItem
          onClick={handleLogout}
          disabled={logout.isPending}
          sx={{ "&.Mui-disabled": { opacity: 0.6 } }}
        >
          <ListItemIcon sx={{ color: "text.secondary", minWidth: 32 }}>
            <LogOut size={16} />
          </ListItemIcon>
          {t("nav.logout")}
        </MenuItem>
      </Menu>
    </>
  );
}

