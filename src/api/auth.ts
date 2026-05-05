// Auth + profile API wrappers and TanStack Query hooks.
//
// Maps 1:1 to the backend's identity routes (PRs #163-178):
//
// - ``POST   /api/v1/auth/cookie/login``    — form-encoded login.
// - ``POST   /api/v1/auth/cookie/logout``   — clears the session.
// - ``GET    /api/v1/users/me``             — current authenticated user.
// - ``GET    /api/v1/profiles``             — household profiles.
// - ``POST   /api/v1/profiles``             — create a new profile.
// - ``POST   /api/v1/profiles/{id}/switch`` — set the active profile.
// - ``PUT    /api/v1/profiles/{id}``        — partial profile update.
// - ``DELETE /api/v1/profiles/{id}``        — soft-delete (409 on last).
//
// The ``credentials: 'include'`` setting in ``client.ts`` is what
// makes the ``homeflix_session`` cookie roundtrip — these hooks
// never touch tokens directly.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError, api } from "./client";
import type {
  CreateProfileInput,
  LoginInput,
  Profile,
  ProfileResponse,
  ProfilesResponse,
  UpdateProfileInput,
  User,
  UserResponse,
} from "./types";

// ── Query keys ──────────────────────────────────────────
//
// Centralised so consumers and mutation invalidations agree on the
// exact same array shape. ``["auth"]`` is the umbrella; sub-keys
// segment the cached views so a logout can wipe both at once with
// ``invalidateQueries({ queryKey: ["auth"] })``.

export const authKeys = {
  all: ["auth"] as const,
  currentUser: ["auth", "currentUser"] as const,
  profiles: ["auth", "profiles"] as const,
};

// ── Queries ─────────────────────────────────────────────

/**
 * Returns the currently authenticated ``User`` or ``null`` when
 * no session cookie is present.
 *
 * 401 is the canonical "anonymous visitor" response from
 * ``/users/me`` — we resolve to ``null`` rather than throw so route
 * guards can read ``data === null`` directly. Other errors keep
 * propagating via TanStack Query's error state.
 */
export function useCurrentUser() {
  return useQuery<User | null>({
    queryKey: authKeys.currentUser,
    queryFn: async () => {
      try {
        const res = await api.get<UserResponse>("/users/me");
        return res.data;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

/**
 * Returns the authenticated user's profiles (empty list when
 * unauthenticated). The ``enabled`` flag could be wired against
 * ``useCurrentUser``'s result, but TanStack Query handles the 401
 * branch identically here so we keep it always-on for simplicity.
 */
export function useProfiles() {
  return useQuery<Profile[]>({
    queryKey: authKeys.profiles,
    queryFn: async () => {
      try {
        const res = await api.get<ProfilesResponse>("/profiles");
        return res.data;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return [];
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

// ── Mutations ───────────────────────────────────────────

/**
 * Submits credentials to the cookie-login endpoint. On success the
 * server sets the ``homeflix_session`` cookie and we invalidate
 * every cached auth query so consumers re-fetch with the new
 * identity.
 */
export function useLogin() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, LoginInput>({
    mutationFn: async ({ email, password }) => {
      // FastAPI Users speaks the OAuth2 password-flow shape here:
      // ``username`` (which we send the email as) + ``password``.
      await api.postForm("/auth/cookie/login", {
        username: email,
        password,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.all });
    },
  });
}

/**
 * Logs out the current session. Wipes every cached query — not just
 * the auth slice — so a subsequent visitor starts with a clean
 * slate (the catalog itself is per-profile from PR #178 onward).
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, void>({
    mutationFn: async () => {
      await api.post<void>("/auth/cookie/logout");
    },
    onSuccess: async () => {
      queryClient.clear();
    },
  });
}

/**
 * Sets the target profile as the active one for the current
 * session. Server returns 204; we then invalidate every catalog
 * query so the next render reflects the new profile's ACL.
 */
export function useSwitchProfile() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (profileId) => {
      await api.post<void>(`/profiles/${profileId}/switch`);
    },
    onSuccess: async () => {
      // Auth slice plus the entire catalog — every list/detail
      // query is now scoped to a different profile_id.
      queryClient.clear();
    },
  });
}

/**
 * Partial profile update. Used by future profile-management UI to
 * grant/revoke library access, rename, toggle the kids flag, etc.
 * The backend's PATCH-style semantics live verbatim in
 * ``UpdateProfileInput``: ``null``/omitted = leave alone, explicit
 * value = replace.
 */
export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, { profileId: string; input: UpdateProfileInput }>({
    mutationFn: async ({ profileId, input }) => {
      const res = await api.put<ProfileResponse>(`/profiles/${profileId}`, input);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.profiles });
    },
  });
}

/**
 * Create a new profile owned by the current user. ``is_kids`` and
 * ``allowed_library_ids`` default to the backend's defaults when
 * omitted (``false`` and ``[]`` respectively — default-deny ACL).
 */
export function useCreateProfile() {
  const queryClient = useQueryClient();
  return useMutation<Profile, Error, CreateProfileInput>({
    mutationFn: async (input) => {
      const res = await api.post<ProfileResponse>("/profiles", input);
      return res.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.profiles });
    },
  });
}

/**
 * Soft-delete a profile. The backend returns 409 if this would
 * leave the user without any active profile — callers should
 * surface that as a friendly "you can't delete the last profile"
 * message rather than letting the generic ``ApiError`` bubble.
 */
export function useDeleteProfile() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (profileId) => {
      await api.del(`/profiles/${profileId}`);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.profiles });
    },
  });
}
