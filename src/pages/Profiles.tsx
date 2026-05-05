import { useEffect, useState } from "react";
import { Alert, Box, CircularProgress, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useLogout, useProfiles, useSwitchProfile } from "../api/auth";
import {
  AuthShell,
  Avatar,
  initialsForName,
  toneForProfile,
} from "../components/auth";
import { Logo } from "../components/Logo";
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
      setError("Não foi possível selecionar este perfil. Tente novamente.");
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
          ← Sair
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
                mb: 1,
                fontSize: { xs: 28, sm: 36 },
                fontWeight: 500,
                letterSpacing: "-0.025em",
                lineHeight: 1.1,
                textAlign: "center",
              }}
            >
              Quem está assistindo?
            </Typography>
            <Typography
              sx={{
                mb: 6,
                fontSize: 14,
                color: "rgba(245, 241, 235, 0.5)",
                textAlign: "center",
              }}
            >
              Toque no perfil para entrar.
            </Typography>

            {error && (
              <Alert
                severity="error"
                sx={{
                  width: "100%",
                  maxWidth: 640,
                  mb: 3,
                  bgcolor: "rgba(248, 113, 113, 0.08)",
                  color: "rgba(252, 165, 165, 0.95)",
                  border: "1px solid rgba(248, 113, 113, 0.25)",
                }}
              >
                {error}
              </Alert>
            )}

            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "repeat(2, 1fr)", sm: "repeat(4, 1fr)" },
                gap: { xs: 1.75, sm: 3 },
                width: "100%",
                maxWidth: 640,
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
                    aria-label={`Entrar como ${profile.name}`}
                    sx={{
                      bgcolor: isActive ? "rgba(255, 255, 255, 0.04)" : "transparent",
                      border: `1px solid ${
                        isActive ? "rgba(217, 119, 87, 0.4)" : "rgba(255, 255, 255, 0.08)"
                      }`,
                      borderRadius: 2,
                      px: 2,
                      py: 3,
                      cursor: disabled ? "not-allowed" : "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 1.5,
                      transition: "all 200ms ease",
                      transform: isActive && !disabled ? "translateY(-2px)" : "none",
                      opacity: disabled ? 0.6 : 1,
                      color: "text.primary",
                      fontFamily: "inherit",
                    }}
                  >
                    <Avatar
                      initials={initialsForName(profile.name)}
                      tone={toneForProfile(profile.id)}
                      size={72}
                      ring={isActive}
                    />
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 500,
                        letterSpacing: "-0.005em",
                      }}
                    >
                      {profile.name}
                    </Typography>
                  </Box>
                );
              })}
            </Box>

            <Box
              component="button"
              type="button"
              onClick={() => navigate("/settings#profiles")}
              sx={{
                mt: 5,
                background: "transparent",
                border: "none",
                color: "primary.main",
                fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                cursor: "pointer",
                "&:hover": { color: "primary.light" },
              }}
            >
              + Gerenciar perfis
            </Box>
          </>
        )}
      </Box>
    </AuthShell>
  );
}

function EmptyProfileState() {
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
        Nenhum perfil ainda
      </Typography>
      <Typography sx={{ fontSize: 14, lineHeight: 1.55, color: "rgba(245, 241, 235, 0.55)" }}>
        Esta conta ainda não tem perfis. Peça ao administrador para criar
        o primeiro perfil — o gerenciamento pelo app chega em breve.
      </Typography>
    </Box>
  );
}
