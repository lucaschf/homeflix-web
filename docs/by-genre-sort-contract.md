# Spec: `sort` parameter for `GET /catalog/by-genre/{genreId}`

Backend contract needed to unlock the sort control on the "Ver Tudo" genre grid
(`GenreGrid` in `src/pages/Browse.tsx`). Today the endpoint returns items merged
**alphabetically by title only** and accepts no `sort` param, so the frontend
ships no sort control. This spec defines the param the frontend is pre-wired for
(see `SORT_ENABLED` in `Browse.tsx` and the `sort` option on `useByGenre`).

## Endpoint

```
GET /api/v1/catalog/by-genre/{genreId}?lang=&type=&limit=&cursor=&sort=
```

`sort` is **new and optional**. Everything else is unchanged.

## `sort` values

| value            | order                                   | notes |
|------------------|-----------------------------------------|-------|
| `title_asc`      | title A→Z (case/diacritic-insensitive)  | **default** — identical to today's behavior |
| `title_desc`     | title Z→A                               | |
| `year_desc`      | release year, newest first              | movie `year` / series `start_year` mapped to one key |
| `year_asc`       | release year, oldest first              | same key mapping |
| `recently_added` | `created_at` descending                 | same merge key `/catalog/recently-added` already uses |

- **Default:** absent/empty `sort` ⇒ `title_asc`. No existing caller breaks.
- **Unknown value:** respond `422` (preferred) so a bug surfaces instead of a
  silent wrong order. The frontend narrows to the union above before sending, so
  a 422 only ever means a contract drift, never normal traffic.

## Cursor pagination (critical)

The stream merges movies + series, so ordering must be **total and stable** or
cursor pagination will duplicate or skip rows across pages.

1. **Deterministic tie-breaker.** Append a unique stable key (e.g. catalog row
   id) as the final sort key for every `sort` value — two 2010 movies, or two
   titles that collide case-folded, must have one fixed order.
2. **Cursor encodes the sort.** The opaque `cursor` must carry (or be validated
   against) the `sort` it was minted under. Changing `sort` mid-pagination
   invalidates the cursor — the frontend always restarts from page 1 (no cursor)
   when `sort` changes, but the backend should reject a cursor+sort mismatch
   rather than silently reinterpret it.
3. The frontend resends the **same `sort` on every page** of a given listing.

## `type` interaction

`sort` applies **after** the `type` filter, within whatever stream `type`
selects (`all` = merged, `movie` / `series` = single). For `year_*` the backend
maps `movie.year` and `series.start_year` to a common comparable key; rows with a
null year sort **last** in both directions (never interleaved into the middle).

## Response

Unchanged — `ApiListResponse<CatalogItem>` with `metadata.pagination.next_cursor`.
No new response fields required. (The header count still comes from the
`/catalog/genres` `count`, not from here.)

## Frontend readiness (already merged, dormant)

- `useByGenre(genreId, { type, sort })` — `sort` is added to the query key and
  sent as a param only when set. With no `sort` the request is byte-identical to
  today's.
- `GenreGrid` renders a sort dropdown (label `browse.sortBy`, options
  `browse.titleAZ` / `titleZA` / `yearNewest` / `yearOldest` / `browse.recentlyAdded`)
  gated behind the `SORT_ENABLED` module flag, driven by a `?sort=` URL param.
- **To enable:** confirm this contract is live, set `SORT_ENABLED = true`, ship.
```
