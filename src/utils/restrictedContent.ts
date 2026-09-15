import { apiErrorCode } from "../api/errors";

/** Body copy per maturity-gate code; the heading is shared. */
const RESTRICTED_BODY_KEYS: Record<string, string> = {
  CONTENT_RESTRICTED_BY_MATURITY: "detail.restricted.maturityBody",
  CONTENT_RESTRICTED_UNRATED: "detail.restricted.unratedBody",
};

/**
 * ``DetailError`` copy for a title the active profile may not watch,
 * or ``undefined`` for any other failure (which keeps the generic
 * "couldn't load" copy).
 *
 * The backend never names the title in these 403s, and neither does
 * the copy: the page has no title or id to show.
 */
export function restrictedContentKeys(
  err: unknown,
): { titleKey: string; bodyKey: string } | undefined {
  const code = apiErrorCode(err);
  const bodyKey = code === undefined ? undefined : RESTRICTED_BODY_KEYS[code];
  return bodyKey ? { titleKey: "detail.restricted.title", bodyKey } : undefined;
}
