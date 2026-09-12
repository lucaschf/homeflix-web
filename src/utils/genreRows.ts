import type { CatalogItem, Genre } from "../api/types";

/**
 * Row composition for the per-genre carousels on Home / Movies / Series.
 *
 * A title carries every genre TMDB tags it with — 2.8 of them on
 * average — so laying out one carousel per genre renders the same
 * poster over and over: the catalog's 701 titles fill 1978 cards. The
 * layout makes it worse on both axes: `/catalog/genres` sorts by count
 * descending, so the broadest (most overlapping) genres are the first
 * rows on the page, and every row is sorted the same way (`title_asc`),
 * so the repeated titles land in the same order row after row. The page
 * reads as copy-paste.
 *
 * The fix is to give each title one home row — its PRIMARY genre.
 * `CatalogItem.genres` preserves TMDB's own ordering, whose first entry
 * is the title's main genre, and the backend localizes it through the
 * same `lang` param it localizes `Genre.name` with, so a row's name and
 * an item's genre labels are directly comparable.
 *
 * Two properties matter here:
 *
 * - The decision is LOCAL. A row needs the item's own genres plus the
 *   set of genre labels that have a row on this page — never what the
 *   other rows happen to have fetched. That keeps it stable under lazy
 *   mounting and independent pagination: a row renders the same items
 *   whether it's the first or the last one scrolled to.
 * - It is INTRINSIC to the title, not to the library. Assigning by
 *   "narrowest genre" (what `useUpNext` does to pick a neighbourhood)
 *   would reshuffle rows as the library grows and would empty exactly
 *   the big, recognizable rows — Ação, Terror, Comédia — because almost
 *   every title in them also carries something narrower.
 */

/** The shape the row rule reads off a catalog row. */
type GenreTagged = Pick<CatalogItem, "genres">;

/** Case/whitespace-insensitive key for comparing two genre labels. */
function genreKey(name: string): string {
  return name.trim().toLocaleLowerCase();
}

/**
 * The genre labels that own a row on the current page, keyed for
 * comparison. Feed it the same `useGenres` result the page laid its
 * rows out from — the type-scoped one on the Movies / Series tabs, so a
 * movie's primary genre resolves against the movie-side labels.
 */
export function genreNameSet(genres: Genre[] | undefined): ReadonlySet<string> {
  return new Set((genres ?? []).map((genre) => genreKey(genre.name)));
}

/**
 * The row that owns `item`: its first genre that actually has a row on
 * this page. Null when none of them do — `/catalog/genres` keeps the
 * first localized label it sees per canonical genre, so a title whose
 * metadata disagrees on a translation can miss every row.
 */
function primaryGenreKey(item: GenreTagged, knownGenreNames: ReadonlySet<string>): string | null {
  for (const name of item.genres) {
    const key = genreKey(name);
    if (knownGenreNames.has(key)) return key;
  }
  return null;
}

/**
 * Whether this genre's row is `item`'s home row.
 *
 * An item nothing can place — no genres, or labels that match no row —
 * counts as owned by every row it appears in. Showing such a title
 * twice is a far smaller failure than dropping it out of the catalog
 * entirely, and it is the same degradation the row falls back to before
 * `/catalog/genres` has resolved (an empty `knownGenreNames` makes
 * every item unplaceable, so the row renders its pre-dedupe content).
 */
export function ownsGenreRow(
  item: GenreTagged,
  genreName: string,
  knownGenreNames: ReadonlySet<string>,
): boolean {
  const primary = primaryGenreKey(item, knownGenreNames);
  return primary === null || primary === genreKey(genreName);
}

/**
 * The items a genre row should render, in the order the listing
 * returned them: everything this row owns, topped up to `minRowSize`
 * with titles it merely shares.
 *
 * The top-up is what keeps genres that are almost never anybody's
 * primary on the page. Mistério holds 71 titles but is the main genre
 * of 7; História holds 5 and is the main genre of none. Without it
 * those rows would render broken or vanish, and the user would lose
 * whole genres from the catalog to win a duplicate. Borrowing stops the
 * moment the visible width is covered, so the cost is a couple dozen
 * repeated cards across the page instead of ~1270.
 */
export function selectGenreRowItems<T extends GenreTagged>(
  items: readonly T[],
  genreName: string,
  knownGenreNames: ReadonlySet<string>,
  minRowSize: number,
): T[] {
  const owned: T[] = [];
  const shared: T[] = [];
  for (const item of items) {
    (ownsGenreRow(item, genreName, knownGenreNames) ? owned : shared).push(item);
  }

  if (owned.length >= minRowSize) return owned;

  const borrowed = new Set<T>(shared.slice(0, minRowSize - owned.length));
  if (borrowed.size === 0) return owned;

  // Re-filter the source instead of concatenating the two buckets, so
  // the row keeps the listing's own order (alphabetical, or whatever
  // `sort` asked for) rather than showing owned titles first and
  // borrowed ones bolted on the end.
  const ownedSet = new Set<T>(owned);
  return items.filter((item) => ownedSet.has(item) || borrowed.has(item));
}
