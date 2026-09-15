/**
 * Compile-time feature flags.
 *
 * These are build-time constants, not runtime toggles — flipping one
 * requires a rebuild/deploy. Use them to keep UI for an in-flight
 * backend feature out of the DOM until the server actually serves it,
 * so users never see a control that does nothing.
 */

/**
 * Custom-list sharing / following (see `docs/list-follow-share-contract.md`).
 *
 * Off until the backend ships the share-token + follow endpoints. While
 * off, the Share affordance, the `/lists/shared/:token` landing, and the
 * followed-list rendering stay out of the UI and none of the sharing
 * hooks are ever called. Flip to `true` once the contract is live.
 */
export const SHARE_ENABLED = true;

/**
 * Per-profile maturity limit and parental PIN (ADR-035).
 *
 * On: the profile form offers the age limit, the PIN challenge guards
 * profile changes and admin writes, and the PIN can be set up in
 * profile management. Requires the backend that stores the limit and
 * gates it behind the PIN to be deployed and migrated. While off, the
 * profile form renders no limit selector and never sends
 * ``maturity_limit``. Admin gating on ``admin_access`` does not depend
 * on this flag: without a PIN the backend reports the same authority
 * as the role.
 */
export const PARENTAL_CONTROLS_ENABLED = true;
