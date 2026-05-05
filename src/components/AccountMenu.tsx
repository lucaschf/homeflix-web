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
import { LogOut, Settings as SettingsIcon, UserCog, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCurrentUser, useLogout, useProfiles } from "../api/auth";
import { Avatar } from "./auth/Avatar";
import { initialsForName, toneForProfile } from "./auth/avatarUtils";

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
  const { data: profiles } = useProfiles();
  const logout = useLogout();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  if (!currentUser) return null;

  // Resolve the active profile from ``/users/me`` so the chip
  // mirrors whatever the backend has bound to the session cookie.
  // If the user signed in but never picked a profile (or a fresh
  // session is still settling), ``active_profile_id`` is ``null`` —
  // fall back to ``profiles[0]`` so the chip still renders an
  // identity hint instead of dropping back to the email-only stub.
  const activeProfileId = currentUser.active_profile_id;
  const activeProfile =
    profiles?.find((p) => p.id === activeProfileId) ?? profiles?.[0] ?? null;

  // The chip prefers the profile's identity (its name → initials,
  // its id → tone, its avatar URL → image). Falls back to the
  // user's email-derived initials when no profile has loaded yet.
  const chipInitials = activeProfile
    ? initialsForName(activeProfile.name)
    : initialsForName(currentUser.email.split("@")[0] ?? currentUser.email);

  // "Switch profile" only makes sense when there's somewhere to
  // switch to. With a single profile the picker page auto-skips
  // (selects it + navigates to "/"), which from the navbar reads
  // as "the page just reloaded itself" — exposing the menu item is
  // a footgun. Hide it; the user can still add a second profile
  // via "Manage profiles" and the item appears as soon as there
  // is one.
  const canSwitchProfile = (profiles?.length ?? 0) > 1;

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleSwitchProfile = () => {
    handleClose();
    navigate("/profiles");
  };

  const handleManageProfiles = () => {
    handleClose();
    navigate("/profiles/manage");
  };

  const handleOpenSettings = () => {
    handleClose();
    navigate("/settings");
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
          p: 0.25,
        }}
      >
        {activeProfile ? (
          <Avatar
            initials={chipInitials}
            tone={toneForProfile(activeProfile.id)}
            avatarUrl={activeProfile.avatar_url}
            size={28}
            shape="circle"
          />
        ) : (
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
            {chipInitials}
          </Box>
        )}
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

        {canSwitchProfile && (
          <MenuItem onClick={handleSwitchProfile}>
            <ListItemIcon sx={{ color: "text.secondary", minWidth: 32 }}>
              <Users size={16} />
            </ListItemIcon>
            {t("nav.switchProfile")}
          </MenuItem>
        )}

        <MenuItem onClick={handleManageProfiles}>
          <ListItemIcon sx={{ color: "text.secondary", minWidth: 32 }}>
            <UserCog size={16} />
          </ListItemIcon>
          {t("nav.manageProfiles")}
        </MenuItem>

        <MenuItem onClick={handleOpenSettings}>
          <ListItemIcon sx={{ color: "text.secondary", minWidth: 32 }}>
            <SettingsIcon size={16} />
          </ListItemIcon>
          {t("nav.settings")}
        </MenuItem>

        <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.08)" }} />

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

