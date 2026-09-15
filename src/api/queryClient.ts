import { hashKey, MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { authKeys } from "./auth";
import { ApiError } from "./client";
import { apiErrorCode } from "./errors";
import {
  isParentalGateHandledByCaller,
  isParentalPinRequired,
  PARENTAL_PIN_REQUIRED_EVENT,
} from "./parentalGate";

/** TanStack Query's own browser default, kept for transient failures. */
const MAX_QUERY_RETRIES = 3;

/**
 * Statuses that are the server's final answer: a missing session
 * (401), a profile or role gate (403) and a title that does not exist
 * for this profile (404). Asking again cannot change them, and each
 * retry only delays the error screen by the backoff.
 */
const FINAL_STATUSES = new Set([401, 403, 404]);

/**
 * Retry policy for every query: never retry a final status, otherwise
 * behave like the library default (up to three retries), which covers
 * 5xx and network failures.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && FINAL_STATUSES.has(error.status)) return false;
  return failureCount < MAX_QUERY_RETRIES;
}

/**
 * Global reaction to a failed query.
 *
 * A 403 ``PARENTAL_PIN_REQUIRED`` on a read means the session's admin
 * authority was suspended after ``/users/me`` was cached (ADR-035). The
 * only reaction is to refetch the current user, so ``admin_access``
 * turns ``"suspended"`` and the guards swap the admin UI for the lock
 * screen. A query never opens the PIN challenge: reads fire on mount
 * and on polling, so a modal here would pop up unasked. The challenge
 * belongs to the mutation the user started.
 *
 * The ``/users/me`` query itself is skipped, so a gate answer there
 * cannot refetch it in a loop. An in-flight refetch is reused rather
 * than restarted when several queries fail together.
 */
function handleQueryError(client: QueryClient, error: unknown, queryHash: string): void {
  if (apiErrorCode(error) !== "PARENTAL_PIN_REQUIRED") return;
  if (queryHash === hashKey(authKeys.currentUser)) return;
  void client.invalidateQueries(
    { queryKey: authKeys.currentUser, exact: true },
    { cancelRefetch: false },
  );
}

/**
 * Global reaction to a failed mutation.
 *
 * A 403 ``PARENTAL_PIN_REQUIRED`` on a write the user started (an admin
 * write under an account with a limited profile, ADR-035 D10) asks
 * ``ParentalPinProvider``, through ``PARENTAL_PIN_REQUIRED_EVENT``, to
 * open the PIN challenge. After the unlock the provider tells the user
 * to repeat the action. The mutation is never sent again from here: this
 * handler has no way to know the write is safe to replay.
 *
 * A mutation marked ``PARENTAL_GATE_HANDLED_BY_CALLER`` is skipped, since
 * ``useParentalUnlock().run`` already challenges and retries it.
 */
function handleMutationError(error: unknown, meta: Record<string, unknown> | undefined): void {
  if (!isParentalPinRequired(error)) return;
  if (isParentalGateHandledByCaller(meta)) return;
  window.dispatchEvent(new CustomEvent(PARENTAL_PIN_REQUIRED_EVENT));
}

/** The app's query client. Tests build theirs here to get the same policy. */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => handleQueryError(client, error, query.queryHash),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        handleMutationError(error, mutation.meta),
    }),
    defaultOptions: { queries: { retry: shouldRetry } },
  });
  return client;
}
