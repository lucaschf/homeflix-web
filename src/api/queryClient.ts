import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

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

/** The app's query client. Tests build theirs here to get the same policy. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: shouldRetry } },
  });
}
