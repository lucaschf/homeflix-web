// Readers for the backend's structured error envelope.
//
// Kept apart from ``client.ts`` on purpose: several suites mock
// ``../api/client`` with a hand-written factory, which would not
// export any helper added there.

import { ApiError } from "./client";

/**
 * Stable error code of a failed API call (``body.code``, e.g.
 * ``CONTENT_RESTRICTED_BY_MATURITY``), or ``undefined`` when ``err``
 * is not an ``ApiError`` or its body carries no code.
 *
 * Branch on this rather than on ``err.message``: the message is
 * operator-facing text that the backend may translate or reword.
 */
export function apiErrorCode(err: unknown): string | undefined {
  if (!(err instanceof ApiError)) return undefined;
  return err.body?.code;
}

/**
 * One value from the ``metadata`` of the error's ``details`` entries,
 * where the backend puts machine-readable extras (e.g.
 * ``retry_after_seconds`` on ``PARENTAL_PIN_LOCKED``). The first
 * detail whose metadata holds ``key`` wins; ``undefined`` when ``err``
 * is not an ``ApiError`` or no detail carries it.
 *
 * The value comes back untyped, so callers narrow it
 * (``typeof value === "number"``) before use.
 */
export function apiErrorMeta(err: unknown, key: string): unknown {
  if (!(err instanceof ApiError)) return undefined;
  const details = err.body?.details;
  if (!Array.isArray(details)) return undefined;
  for (const detail of details) {
    const metadata: unknown = (detail as { metadata?: unknown } | null)?.metadata;
    if (metadata !== null && typeof metadata === "object" && key in metadata) {
      return (metadata as Record<string, unknown>)[key];
    }
  }
  return undefined;
}
