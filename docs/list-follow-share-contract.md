# Implementation spec: follow a shared custom list (backend)

**Audience:** an implementer (human or Claude Code) working **inside the `homeflix` backend repo**, on a fresh branch from the current `origin/develop`.

**Goal:** let a household member **share a custom list** via a link and let another member **follow** it — a live, read-only view that reflects the owner's current items (not a copy). The frontend ships this behind a `SHARE_ENABLED` flag and enables it once these endpoints are live (mirrors the `?sort=` rollout in `docs/by-genre-sort-contract.md`).

**Scope:** same-instance only. Lists reference this catalog's `media_id`s (`mov_/ser_`), which are not portable across instances. No public/anonymous access — the follower must be an authenticated member of this HomeFlix.

> ⚠️ **Staleness caveat.** This spec is written from a frontend-side understanding plus a working copy of the backend that was ~387 commits behind `origin/develop`. The custom-lists / collections BC, the profile access port, and the subscriber pattern below **may have moved or been renamed**. Before implementing, confirm the current structures (`rg "CustomList"`, `rg "ProfileLibraryAccess"`, `rg -i "subscrib"`). Treat the *behavior* and *access rules* here as authoritative; treat *locations/names* as a starting map.

---

## Concepts

- **Owner** — the profile that created the list (existing `owner_profile_id`, implicit today via auth scoping).
- **Share token** — an opaque, unguessable token minted for a list when the owner shares it. One token per list (idempotent); revocable. Presence of a token ⇒ the list `is_shared`.
- **Follow** — a join `(follower_profile_id, list_id, followed_at)`. A followed list is **read-only** for the follower and **live** (reads reflect the owner's current items). Mirror the existing catalog-request *subscriber* pattern.

Reuse the existing subscriber/notification primitives where they fit rather than inventing a parallel mechanism.

## Access control (non-negotiable, HomeFlix-specific)

A followed list may contain media the **follower's** profile cannot access (`allowed_library_ids`, kids profile). Every read of a shared/followed list **must filter items through the follower's access** — reuse the existing profile library-access port (the one the by-genre listing already threads as `allowed_library_ids` / `ProfileLibraryAccessPort`).

- Filter out items whose media lives in a library the follower can't see.
- Return a count of hidden items so the UI can show "N itens ocultos pelo seu perfil".
- A kids profile must never see restricted titles via a followed list. Sharing must not become an access-control bypass.

The **owner's** view of their own list is unchanged (they see everything they own).

## Endpoints

All under the existing `/api/v1/custom-lists` prefix; all require auth.

| Method & path | Purpose | Notes |
|---|---|---|
| `POST /custom-lists/{id}/share` | Mint (or return existing) share token for a list the caller owns | Idempotent → `{ token, url_path }`. 403 if not owner. |
| `DELETE /custom-lists/{id}/share` | Revoke sharing | Invalidates the token. Decide + document: does it also drop existing followers? **Recommended:** yes — revoke means "stop sharing", existing follows are removed. |
| `GET /custom-lists/shared/{token}` | Read-only preview of a shared list | Returns list meta (name, description, owner display name, item_count) + items **filtered by the caller's access** + `hidden_count`. 404 on unknown/revoked token. |
| `POST /custom-lists/shared/{token}/follow` | Follow the shared list | Idempotent. 404 on bad token. Owner following own list → 409/no-op. |
| `DELETE /custom-lists/{id}/follow` | Unfollow | Removes the caller's follow. Idempotent. |

Reads that change:
- `GET /custom-lists` (list mine): each row gains `is_shared: bool` (owner side) and the response also includes **followed** lists flagged `is_followed: true` + `owner_name`, OR expose followed lists via a separate `GET /custom-lists/followed`. **Recommended:** include followed lists in the same response with an `is_followed` flag + `owner_name`, so the frontend renders one "My Lists" surface; followed rows are read-only and don't count against the owner's `MAX_LISTS` quota.
- `GET /custom-lists/{id}/items` for a **followed** list must apply the same access filter as the shared preview.

## Response shape additions

`CustomListOutput` gains:
- `is_shared: bool` — the caller owns it and a token exists.
- `is_followed: bool` — the caller follows it (doesn't own it).
- `owner_name: string | null` — display name of the owner (only meaningful/!null for followed rows).

Shared preview (`GET /custom-lists/shared/{token}`) returns:
- `list`: `{ id, name, description, owner_name, item_count }`
- `items`: `CustomListItemOutput[]` (access-filtered)
- `hidden_count: int`
- `is_following: bool` — whether the caller already follows it.

## Edge cases (each needs a test)

1. **Owner deletes a shared list** → followers' follow rows are cleaned up; a follower's `GET /custom-lists` no longer shows it (no dangling read).
2. **Owner revokes share** → token 404s; existing follows removed (per recommendation) so followers see it disappear.
3. **Kids / restricted access** → a followed list's restricted items never leak; `hidden_count` reflects them; a fully-restricted list shows as empty-with-notice, not an error.
4. **Follow idempotency** → double-follow is a no-op, not a duplicate row.
5. **Owner can't follow own list** → 409/no-op.
6. **Quota** → followed lists don't count toward the owner's `MAX_LISTS` (10).
7. **Token unguessable** → sufficient entropy; not a sequential id; revocation invalidates it.
8. **Non-member / unauthenticated** hitting `/shared/{token}` → auth required (401), never public.

## Constraints (HomeFlix ADRs)

- DTOs frozen; use cases pure (deps via constructor); DI wiring only in routes (ADR-004).
- Entirely within the custom-lists/collections BC — no cross-module import; if follower access needs media/library data, go through the existing read port / ACL (ADR-009), not a direct import.
- Prefixed ids for any new aggregate/entity (ADR-002); immutable `with_*` updates (ADR-007).
- If "follow" introduces a genuinely new decision (e.g. a new aggregate), consider an ADR.

## Definition of done

- [ ] Share / revoke / preview / follow / unfollow endpoints, owner-only where noted.
- [ ] Followed lists surface in the caller's list reads, flagged + read-only, excluded from quota.
- [ ] **Access filtering** applied on every shared/followed read; `hidden_count` correct; kids never bypassed — covered by tests.
- [ ] Deletion/revocation clean up follows; no dangling reads.
- [ ] `mypy` + `ruff` clean; suite green.
- [ ] Frontend then flips `SHARE_ENABLED` — the UI (share dialog, `/lists/shared/:token` landing, read-only followed rendering) is already wired against this contract.
