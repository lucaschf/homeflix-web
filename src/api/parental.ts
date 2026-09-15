// Parental PIN API wrappers and TanStack Query hooks (ADR-035).
//
// - ``PUT  /api/v1/parental/pin``        — set or replace the PIN (password).
// - ``POST /api/v1/parental/pin/remove`` — remove the PIN (password).
// - ``POST /api/v1/parental/unlock``     — unlock this device with the PIN.
//
// Every failure on this surface is a 4xx other than 401 (a wrong password
// or PIN is 403), so none of these calls trips the session-expired guard.
// ``DELETE /parental/unlock`` has no hook: nothing in the UI locks early.

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authKeys } from "./auth";
import { api } from "./client";

export interface SetParentalPinInput {
  /** The account password: the PIN's root of trust (Amendment 7 D3). */
  current_password: string;
  /** The new PIN: exactly six ASCII digits. */
  pin: string;
}

export interface RemoveParentalPinInput {
  /** The account password. */
  current_password: string;
}

export interface UnlockParentalInput {
  /** The account's parental PIN. */
  pin: string;
}

/**
 * Sets or replaces the account's parental PIN.
 *
 * Refetches ``/users/me`` on success so ``parental_pin_configured`` and
 * ``admin_access`` reflect the new PIN. A wrong password is 403
 * ``ACCOUNT_PASSWORD_INVALID`` and a malformed PIN is 422.
 */
export function useSetParentalPin() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, SetParentalPinInput>({
    mutationFn: async (input) => {
      await api.put<void>("/parental/pin", input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
    },
  });
}

/**
 * Removes the account's parental PIN.
 *
 * Refetches ``/users/me`` on success. A wrong password is 403
 * ``ACCOUNT_PASSWORD_INVALID``; a live profile with an age limit is 409
 * ``PARENTAL_PIN_IN_USE``.
 */
export function useRemoveParentalPin() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, RemoveParentalPinInput>({
    mutationFn: async (input) => {
      await api.post<void>("/parental/pin/remove", input);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: authKeys.currentUser });
    },
  });
}

/**
 * Unlocks this device with the parental PIN.
 *
 * On success it refetches ``/users/me``, whose ``admin_access`` follows the
 * unlock window, and ``["libraries"]``, whose ``paths`` are only served
 * while the session holds admin authority. A wrong PIN is 403
 * ``PARENTAL_PIN_INVALID``; a locked device is 403 ``PARENTAL_PIN_LOCKED``
 * with ``details[0].metadata.retry_after_seconds``; an account without a
 * PIN is 409 ``PARENTAL_PIN_NOT_CONFIGURED``.
 */
export function useUnlockParental() {
  const queryClient = useQueryClient();
  return useMutation<void, Error, UnlockParentalInput>({
    mutationFn: async ({ pin }) => {
      await api.post<void>("/parental/unlock", { pin });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: authKeys.currentUser }),
        queryClient.invalidateQueries({ queryKey: ["libraries"] }),
      ]);
    },
  });
}
