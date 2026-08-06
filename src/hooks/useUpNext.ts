import { useMemo } from "react";
import {
  useByGenre,
  useCollection,
  useGenres,
  useRelatedMovies,
  useRelatedSeries,
  type CatalogTypeFilter,
} from "../api/hooks";
import type { CatalogItem, CollectionPart, Genre, MovieSummary, SeriesSummary } from "../api/types";

/**
 * One suggestion rendered by the post-play panel.
 *
 * Normalized shape so the panel doesn't have to branch on where the
 * suggestion came from — `MovieSummary`, `CollectionPart` and
 * `CatalogItem` all collapse into this.
 */
export interface UpNextItem {
  /** External id — `mov_xxx` or `ser_xxx`. */
  id: string;
  mediaType: "movie" | "series";
  title: string;
  /** Pre-formatted "1998 · 1h 22min" line. */
  subtitle: string;
  synopsis?: string;
  posterUrl?: string;
  backdropUrl?: string;
  /** Which source produced the item. Kept so the panel can label the
   *  hero differently when it's the next film in a franchise. */
  source: "collection" | "related" | "genre";
}

/**
 * Turn a `HH:MM:SS` runtime into a compact "1h 22min" label.
 *
 * The API hands back a zero-padded clock string (`duration_formatted`,
 * `runtime_formatted`), which reads like a timestamp rather than a
 * duration when it sits next to a release year. Returns an empty
 * string for anything unparseable so callers can just filter falsy
 * segments out of the subtitle.
 */
function formatRuntime(clock: string | null | undefined): string {
  if (!clock) return "";
  const parts = clock.split(":").map(Number);
  if (parts.length < 2 || parts.some((n) => !Number.isFinite(n))) return "";
  const [h, m] = parts.length === 3 ? parts : [0, parts[0]];
  if (h > 0) return m > 0 ? `${h}h ${m}min` : `${h}h`;
  return `${m}min`;
}

function subtitleOf(year: number | null | undefined, runtime?: string | null): string {
  return [year ? String(year) : "", formatRuntime(runtime)].filter(Boolean).join(" · ");
}

function fromMovieSummary(m: MovieSummary): UpNextItem {
  return {
    id: m.id,
    mediaType: "movie",
    title: m.title,
    subtitle: subtitleOf(m.year, m.duration_formatted),
    synopsis: m.synopsis ?? undefined,
    posterUrl: m.poster_path ?? undefined,
    backdropUrl: m.backdrop_path ?? undefined,
    source: "related",
  };
}

function fromSeriesSummary(s: SeriesSummary): UpNextItem {
  return {
    id: s.id,
    mediaType: "series",
    title: s.title,
    subtitle: subtitleOf(s.start_year),
    synopsis: s.synopsis ?? undefined,
    posterUrl: s.poster_path ?? undefined,
    backdropUrl: s.backdrop_path ?? undefined,
    source: "related",
  };
}

function fromCatalogItem(c: CatalogItem): UpNextItem {
  return {
    id: c.id,
    mediaType: c.type,
    title: c.title,
    subtitle: subtitleOf(c.year),
    synopsis: c.synopsis ?? undefined,
    posterUrl: c.poster_path ?? undefined,
    backdropUrl: c.backdrop_path ?? undefined,
    source: "genre",
  };
}

/**
 * Order the in-catalog parts of a franchise so the *next* film comes
 * first.
 *
 * Someone who just finished part 1 wants part 2, not the box-set order
 * — so parts released after the title being watched lead, ascending,
 * and the earlier ones trail behind them as a weaker fallback. Parts
 * TMDB knows about but the library doesn't hold are dropped: the panel
 * only ever offers something that can actually be played.
 */
function franchiseParts(parts: CollectionPart[], currentYear: number | null): UpNextItem[] {
  const playable = parts
    .filter((p): p is CollectionPart & { movie_id: string } => p.in_catalog && !!p.movie_id)
    .sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

  const after = currentYear === null ? [] : playable.filter((p) => (p.year ?? 0) > currentYear);
  const before =
    currentYear === null ? playable : playable.filter((p) => (p.year ?? 0) <= currentYear);

  return [...after, ...before].map((p) => ({
    id: p.movie_id,
    mediaType: "movie" as const,
    title: p.title,
    subtitle: subtitleOf(p.year, p.runtime_formatted),
    synopsis: p.synopsis ?? undefined,
    posterUrl: p.local_poster_path ?? p.poster_url ?? undefined,
    backdropUrl: p.local_backdrop_path ?? p.backdrop_url ?? undefined,
    source: "collection" as const,
  }));
}

/**
 * Resolve a title's genre labels to the genre *id* the by-genre
 * listing expects, and pick the most useful one.
 *
 * Two problems solved here. First, a detail payload carries genres
 * already localized for display ("Família"), while
 * `/catalog/by-genre/{id}` keys on the canonical id ("Family") — going
 * straight from one to the other silently returns nothing. The genres
 * listing carries both halves, so it doubles as the lookup table.
 *
 * Second, the first genre TMDB reports is usually the broadest one,
 * and "anything else in Family" is a weak suggestion. Preferring the
 * narrowest genre the title carries gives a tighter neighbourhood —
 * but only while it still holds enough titles to fill the panel, so
 * `minCount` guards against picking a genre with two entries in it.
 * Below that bar the broadest genre wins instead.
 */
function useResolvedGenre(
  names: string[] | undefined,
  type: CatalogTypeFilter,
  minCount: number,
): Genre | null {
  const { data: genres } = useGenres({ type });
  return useMemo(() => {
    if (!names?.length || !genres?.length) return null;
    const lookup = new Map<string, Genre>();
    for (const genre of genres) {
      lookup.set(genre.name.toLowerCase(), genre);
      lookup.set(genre.id.toLowerCase(), genre);
    }
    const matched = names
      .map((name) => lookup.get(name.toLowerCase()))
      .filter((genre): genre is Genre => !!genre);
    if (matched.length === 0) return null;
    const narrowestFirst = [...matched].sort((a, b) => a.count - b.count);
    const specific = narrowestFirst.find((genre) => genre.count >= minCount);
    return specific ?? narrowestFirst[narrowestFirst.length - 1];
  }, [names, genres, minCount]);
}

export interface UpNextResult {
  items: UpNextItem[];
  isLoading: boolean;
  /**
   * Localized name of the genre the filler was drawn from, so the
   * panel can label a genre-only grid as what it actually is instead
   * of overclaiming "more like this".
   */
  genreName: string | null;
}

/** Merge the sources in priority order, de-duplicated and capped. */
function merge(excludeId: string, limit: number, ...sources: UpNextItem[][]): UpNextItem[] {
  const seen = new Set<string>([excludeId]);
  const out: UpNextItem[] = [];
  for (const source of sources) {
    for (const item of source) {
      if (out.length >= limit) return out;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return out;
}

interface MovieUpNextArgs {
  movieId: string;
  /**
   * Gates every query. Held false until playback nears the credits so a
   * normal viewing session doesn't pay for three extra requests it will
   * never show.
   */
  enabled: boolean;
  /** TMDB collection id, when the movie belongs to a franchise. */
  collectionTmdbId?: number | null;
  /** The movie's genre labels, as the detail payload reports them. */
  genres?: string[];
  /** Release year of the movie being watched; orders franchise parts. */
  year?: number | null;
  limit?: number;
}

/**
 * Suggestions for the movie post-play panel, in descending order of how
 * strong the signal is:
 *
 *   1. the rest of the franchise held locally (`/collections/{tmdb_id}`)
 *   2. TMDB recommendations that exist in the catalog (`/movies/{id}/related`)
 *   3. anything else in the same genre (`/catalog/by-genre/{genre}`)
 *
 * The chain exists because step 2 alone is routinely thin — it's the
 * intersection of TMDB's recommendation list with a personal library,
 * so a title with no franchise and an obscure TMDB entry can easily
 * yield one or two rows. Filling from the genre listing keeps the panel
 * from rendering a near-empty grid.
 *
 * Every query is disabled until `enabled` flips, and each one is
 * independently best-effort: a failure or an empty result just means
 * the next source contributes more.
 */
export function useMovieUpNext({
  movieId,
  enabled,
  collectionTmdbId,
  genres,
  year,
  limit = 5,
}: MovieUpNextArgs): UpNextResult {
  const genre = useResolvedGenre(genres, "movie", limit + 1);
  const related = useRelatedMovies(enabled ? movieId : undefined, 12);
  const collection = useCollection(enabled ? collectionTmdbId ?? undefined : undefined);
  const byGenre = useByGenre(enabled && genre ? genre.id : "", { type: "movie" });

  const collectionParts = collection.data?.parts;
  const relatedMovies = related.data;
  const genreItems = byGenre.items;

  const items = useMemo(
    () =>
      merge(
        movieId,
        limit,
        franchiseParts(collectionParts ?? [], year ?? null),
        (relatedMovies ?? []).map(fromMovieSummary),
        genreItems.map(fromCatalogItem),
      ),
    [movieId, limit, collectionParts, relatedMovies, genreItems, year],
  );

  return {
    items,
    isLoading: related.isLoading || collection.isLoading || byGenre.isLoading,
    genreName: genre?.name ?? null,
  };
}

interface SeriesUpNextArgs {
  seriesId: string;
  enabled: boolean;
  /** The show's genre labels, as the detail payload reports them. */
  genres?: string[];
  limit?: number;
}

/**
 * Suggestions for the series post-play panel — same contract as
 * `useMovieUpNext` minus the franchise step, which has no equivalent
 * for shows. Only reached when the episode that just finished was the
 * last one available, since anything earlier hands off to the existing
 * next-episode countdown.
 */
export function useSeriesUpNext({
  seriesId,
  enabled,
  genres,
  limit = 5,
}: SeriesUpNextArgs): UpNextResult {
  const genre = useResolvedGenre(genres, "series", limit + 1);
  const related = useRelatedSeries(enabled ? seriesId : undefined, 12);
  const byGenre = useByGenre(enabled && genre ? genre.id : "", { type: "series" });

  const relatedSeries = related.data;
  const genreItems = byGenre.items;

  const items = useMemo(
    () =>
      merge(
        seriesId,
        limit,
        (relatedSeries ?? []).map(fromSeriesSummary),
        genreItems.map(fromCatalogItem),
      ),
    [seriesId, limit, relatedSeries, genreItems],
  );

  return {
    items,
    isLoading: related.isLoading || byGenre.isLoading,
    genreName: genre?.name ?? null,
  };
}
