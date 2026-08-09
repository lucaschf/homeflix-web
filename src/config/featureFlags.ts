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
