import { useEffect, useState } from "react";
import { Alert, Box, Button, CircularProgress, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { whiteAlpha, inkAlpha } from "../theme/tokens";
import { error as errorPalette } from "../theme/colors";
import { useNavigate } from "react-router-dom";
import { useLogout, useProfiles, useSwitchProfile } from "../api/auth";
import {
  AuthShell,
  Avatar,
  initialsForName,
  toneForProfile,
} from "../components/auth";
import { Logo } from "../components/Logo";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import type { Profile } from "../api/types";

/**
 * Variação B profile picker — same dark surface + halos as the
 * login screen, with a 4-up grid of profile cards.
 *
 * Behaviour:
 * - 0 profiles → empty state pointing at the bootstrap CLI (the
 *   admin must create at least one profile before the picker is
 *   useful — backend has no public signup yet).
 * - 1 profile → auto-skip: switch + navigate home without rendering
 *   the picker. Saves a click for the most common case (single
 *   household account).
 * - 2+ profiles → render the picker.
 *
 * "+ Gerenciar perfis" is shown but disabled — the profile
 * management screen lands in a follow-up PR.
 */
export function Profiles() {
  const { t } = useTranslation();
  useDocumentTitle(t("auth.picker.headline"));
  const navigate = useNavigate();
  const profilesQuery = useProfiles();
  const switchProfile = useSwitchProfile();
  const logout = useLogout();

  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Anonymous visitors are bounced to ``/login`` by the route-level
  // ``RequireAuth`` guard before this component ever mounts, so no
  // in-page redirect effect is needed.

  // Auto-skip when the household has exactly one profile. The
  // effect runs once profiles resolve; ``switchProfile`` carries
  // its own loading state so the next render shows nothing useful
  // and that's fine — the navigate happens immediately after.
  useEffect(() => {
    if (profilesQuery.data && profilesQuery.data.length === 1) {
      const only = profilesQuery.data[0]!;
      switchProfile.mutate(only.id, {
        onSuccess: () => navigate("/", { replace: true }),
      });
    }
    // ``switchProfile`` is stable (TanStack Query memoises mutations
    // by query key), but excluding it from deps to avoid the auto-
    // skip retriggering on cache writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesQuery.data, navigate]);

  async function pickProfile(profile: Profile) {
    setError(null);
    try {
      await switchProfile.mutateAsync(profile.id);
      navigate("/", { replace: true });
    } catch {
      setError(t("auth.picker.switchError"));
    }
  }

  async function onLogout() {
    try {
      await logout.mutateAsync();
    } finally {
      navigate("/login", { replace: true });
    }
  }

  const loading = profilesQuery.isLoading;
  const profiles = profilesQuery.data ?? [];

  return (
    <AuthShell>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 3, sm: 4.5 },
          py: 3.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Logo size={22} />
          <Typography sx={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.01em" }}>
            HomeFlix
          </Typography>
        </Box>
        <Box
          component="button"
          onClick={onLogout}
          disabled={logout.isPending}
          sx={{
            background: "transparent",
            border: "none",
            color: "text.secondary",
            cursor: "pointer",
            fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            "&:hover:not(:disabled)": { color: "text.primary" },
            "&:disabled": { opacity: 0.5, cursor: "not-allowed" },
          }}
        >
          {t("auth.picker.logoutShort")}
        </Box>
      </Box>

      <Box
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
        }}
      >
        {loading && <CircularProgress sx={{ color: "primary.main" }} />}

        {!loading && profiles.length === 0 && (
          <EmptyProfileState />
        )}

        {!loading && profiles.length > 1 && (
          <>
            <Typography
              variant="h1"
              sx={{
                mb: { xs: 4, sm: 6 },
                fontSize: { xs: 32, sm: 48 },
                fontWeight: 400,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                textAlign: "center",
                color: inkAlpha(0.92),
              }}
            >
              {t("auth.picker.headline")}
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  width: "100%",
                  maxWidth: 640,
                  mb: 3,
                  bgcolor: alpha(errorPalette.main, 0.08),
                  color: alpha(errorPalette.light, 0.95),
                  border: `1px solid ${alpha(errorPalette.main, 0.25)}`,
                }}
              >
                {error}
              </Alert>
            )}

            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                alignItems: "flex-start",
                gap: { xs: 3, sm: 5 },
                width: "100%",
                maxWidth: 880,
                mb: { xs: 5, sm: 7 },
              }}
            >
              {profiles.map((profile) => {
                const isActive = hoveredId === profile.id;
                const disabled = switchProfile.isPending;
                return (
                  <Box
                    key={profile.id}
                    component="button"
                    type="button"
                    onMouseEnter={() => setHoveredId(profile.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    onFocus={() => setHoveredId(profile.id)}
                    onBlur={() => setHoveredId(null)}
                    onClick={() => pickProfile(profile)}
                    disabled={disabled}
                    aria-label={t("auth.picker.enterAs", { name: profile.name })}
                    sx={{
                      background: "transparent",
                      border: "none",
                      cursor: disabled ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      transition: "transform 200ms ease",
                      transform: isActive && !disabled ? "translateY(-3px)" : "none",
                      opacity: disabled ? 0.6 : 1,
                      color: "text.primary",
                      fontFamily: "inherit",
                      p: 0,
                    }}
                  >
                    <Avatar
                      initials={initialsForName(profile.name)}
                      tone={toneForProfile(profile.id)}
                      avatarUrl={profile.avatar_url}
                      size={120}
                      shape="rounded"
                      ring={isActive}
                    />
                    <Typography
                      sx={{
                        fontSize: 15,
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                        color: isActive
                          ? whiteAlpha(0.95)
                          : whiteAlpha(0.6),
                        transition: "color 200ms ease",
                      }}
                    >
                      {profile.name}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            {/* Outlined button using the host MUI theme so the
                button reads as part of the same system as Settings
                / dialog actions — the Netflix-style sharp-cornered
                border was clashing with the rest of the app. */}
            <Button
              onClick={() =>
                navigate("/profiles/manage", { state: { from: "/profiles" } })
              }
              variant="outlined"
              sx={{
                px: 4,
                py: 1.25,
                borderColor: whiteAlpha(0.15),
                color: "text.primary",
                textTransform: "none",
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: "0.02em",
                "&:hover": {
                  borderColor: whiteAlpha(0.3),
                  bgcolor: whiteAlpha(0.04),
                },
              }}
            >
              {t("auth.picker.manageProfiles")}
            </Button>
          </>
        )}
      </Box>
    </AuthShell>
  );
}

function EmptyProfileState() {
  const { t } = useTranslation();
  return (
    <Box sx={{ maxWidth: 480, textAlign: "center" }}>
      <Typography
        variant="h1"
        sx={{
          mb: 1.5,
          fontSize: { xs: 26, sm: 32 },
          fontWeight: 500,
          letterSpacing: "-0.025em",
          lineHeight: 1.1,
        }}
      >
        {t("auth.picker.emptyTitle")}
      </Typography>
      <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: inkAlpha(0.55) }}>
        {t("auth.picker.emptyBody")}
      </Typography>
    </Box>
  );
}
