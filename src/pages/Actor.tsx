import { useEffect, useRef, useState } from "react";
import { Avatar, Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation, type TFunction } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMoviesByActor, usePerson } from "../api/hooks";
import type { PersonBio } from "../api/types";
import { MediaCard } from "../components/MediaCard";

/** Compute initials for the avatar fallback when no photo is provided. */
function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * "Movies featuring this actor" page.
 *
 * Reads the actor's display name from the route param (URL-decoded
 * by ``useParams``) and fetches movies whose cast contains that
 * exact name via ``useMoviesByActor``. The avatar and TMDB person
 * id are passed via ``location.state`` from ``CastCard`` so the
 * navigation doesn't have to refetch the source movie's cast — and
 * direct URLs (bookmark, share) still work, just with a name-only
 * header that fetches no bio.
 *
 * Bio (biography, birth date, known department) is fetched lazily
 * from ``/api/v1/people/:id`` via ``usePerson``; the request is
 * skipped when ``tmdb_id`` is absent and 404 / network failures
 * collapse to ``null`` so the page renders the catalog half even
 * if TMDB is down.
 *
 * Grid + infinite scroll mirror ``Browse``'s ``GenreGrid`` so the
 * "browse a slice of the catalog" UX feels the same regardless of
 * the filter axis.
 */
export function Actor() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { name: rawName } = useParams<{ name: string }>();

  // ``useParams`` already decodes ``%20`` etc., so the value is the
  // actor's display name as the user would read it.
  const actorName = rawName ?? "";

  // Optional photo + TMDB person id passed via ``CastCard``'s
  // navigation state. Lives on ``location.state`` so deep-linking
  // still works (state is just ``null`` then) and falls back to
  // initials + name-only header.
  const navState = location.state as
    | { profilePath?: string | null; tmdbId?: number | null }
    | null;
  const navProfilePath = navState?.profilePath ?? null;
  const navTmdbId = navState?.tmdbId ?? null;

  const { data: person } = usePerson(navTmdbId);

  // Use the bio's profile photo when available (richer / always
  // present when the person has any TMDB photo) and fall back to
  // the cast-card's photo, then to initials.
  const profilePath = person?.profile_path ?? navProfilePath;

  const {
    movies,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMoviesByActor(actorName);

  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!hasNextPage || isFetchingNextPage) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "400px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  if (isLoading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress color="primary" />
      </Box>
    );
  }

  return (
    // Centered, max-width container — LordFlix-style. Without the cap
    // the filmography grid stretches across very wide monitors and
    // posters end up much bigger than the same posters anywhere else
    // in the app. ``1560`` is sized so the flex-wrap layout below
    // fits five ``280px`` posters per row at ``lg`` (the carousel
    // card size on the Home / Browse pages) — ``5 × 280 + 4 × 16
    // (gaps) + 64 (padding) = 1528``, with a small slack so the
    // row doesn't snap to four when fonts / theme spacing nudge.
    <Box sx={{ maxWidth: 1560, mx: "auto", pt: { xs: 4, md: 6 } }}>
      {/* Header — LordFlix-inspired layout. Top row pairs the avatar
        with name + meta line + bio. Meta line collects the facts
        TMDB exposes (born/died, place of birth, primary department)
        so the page is informative even before the user reads the
        bio prose. */}
      <Box
        sx={{
          display: "flex",
          // Mobile stacks avatar + meta vertically (avatar centered
          // on top, info centered below) — side-by-side on a narrow
          // viewport leaves the name cramped against the right edge
          // and the bio paragraph wraps awkwardly into a thin
          // column. Desktop keeps the LordFlix-style row layout.
          flexDirection: { xs: "column", md: "row" },
          alignItems: { xs: "center", md: "flex-start" },
          textAlign: { xs: "center", md: "left" },
          gap: { xs: 2, md: 4 },
          px: { xs: 2, md: 4 },
          mb: { xs: 4, md: 6 },
        }}
      >
        <Avatar
          src={profilePath ?? undefined}
          alt={actorName}
          sx={{
            width: { xs: 120, md: 160 },
            height: { xs: 120, md: 160 },
            flexShrink: 0,
            bgcolor: "rgba(255,255,255,0.08)",
            fontSize: { xs: "2.25rem", md: "3rem" },
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {initialsFor(actorName)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1, width: "100%" }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "1.5rem", md: "2.75rem" },
              fontWeight: 700,
              lineHeight: 1.1,
              mb: { xs: 0.75, md: 1 },
            }}
          >
            {actorName}
          </Typography>
          <PersonMetaLine
            person={person ?? null}
            movieCount={movies.length}
            lang={i18n.language}
            t={t}
          />
          {person?.biography ? (
            <PersonBiography text={person.biography} t={t} />
          ) : null}
        </Box>
      </Box>

      {movies.length > 0 && (
        <>
          <Box sx={{ px: { xs: 2, md: 4 }, mb: { xs: 2, md: 3 } }}>
            <Typography
              variant="h2"
              sx={{
                fontSize: { xs: "1rem", md: "1.25rem" },
                fontWeight: 600,
              }}
            >
              {t("actor.filmography")}
            </Typography>
          </Box>

          <Box
            sx={{
              // Flex wrap (instead of a 1fr grid) so cards keep their
              // intrinsic carousel size — ``MediaCard`` without
              // ``fullWidth`` falls back to ``{ xs: 140, sm: 200,
              // md: 240, lg: 280 }``, matching the Home and Browse
              // carousels exactly. Stretching to 1fr made the actor
              // grid look "off" next to the rest of the app.
              display: "flex",
              flexWrap: "wrap",
              // Centered so the row stays balanced when the
              // viewport falls between two card-counts (e.g. wide
              // enough for 4 but not 5). Without it the trailing
              // slack would all sit on the right edge and look like
              // a missing column.
              justifyContent: "center",
              gap: { xs: 1, sm: 1.5, md: 2 },
              px: { xs: 2, md: 4 },
            }}
          >
            {movies.map((movie) => (
              <MediaCard
                key={movie.id}
                title={movie.title}
                year={movie.year}
                imageUrl={movie.poster_path ?? undefined}
                synopsis={movie.synopsis ?? undefined}
                variant="poster"
                mediaId={movie.id}
                mediaType="movie"
                onPlay={() => navigate(`/play/movie/${movie.id}`)}
                onClick={() => navigate(`/movie/${movie.id}`)}
              />
            ))}
          </Box>
        </>
      )}

      <Box
        ref={sentinelRef}
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 80,
          mt: 2,
        }}
      >
        {isFetchingNextPage && <CircularProgress color="primary" size={28} />}
      </Box>
    </Box>
  );
}

/**
 * One-line summary under the actor's name: localized birth/death
 * dates, place of birth, primary department, and the count of
 * movies in the local catalog. Each fact only renders when present
 * so an actor with sparse TMDB metadata still gets a clean line
 * (just the catalog count) instead of stray separators.
 */
function PersonMetaLine({
  person,
  movieCount,
  lang,
  t,
}: {
  person: PersonBio | null;
  movieCount: number;
  lang: string;
  t: TFunction;
}) {
  // Bullet-separated parts so each fact is independently optional.
  // Built up incrementally; the join below skips empty slots so
  // missing data never leaves a dangling separator.
  const parts: string[] = [];

  if (person?.birthday) {
    const formatted = formatDate(person.birthday, lang);
    if (formatted) {
      parts.push(
        person.deathday
          ? t("actor.lifeSpan", {
              birth: formatted,
              death: formatDate(person.deathday, lang) ?? person.deathday,
            })
          : t("actor.born", { date: formatted }),
      );
    }
  }
  if (person?.place_of_birth) parts.push(person.place_of_birth);
  if (person?.known_for_department) {
    parts.push(localizedDepartment(person.known_for_department, t));
  }
  parts.push(
    movieCount === 0
      ? t("actor.noMovies")
      : t("actor.movieCount", { count: movieCount }),
  );

  return (
    <Typography
      variant="body2"
      color="text.secondary"
      sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}
    >
      {parts.join(" · ")}
    </Typography>
  );
}

/** Format an ISO ``YYYY-MM-DD`` for the active locale. */
function formatDate(iso: string, lang: string): string | null {
  // Append ``T00:00`` so ``Date`` parses the date in local time
  // instead of UTC — otherwise Brazilians see the previous day for
  // dates near midnight UTC.
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(lang, {
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date);
  } catch {
    return iso;
  }
}

/** Map a TMDB department string to its localized label, with fallback. */
function localizedDepartment(department: string, t: TFunction): string {
  // ``i18next`` returns the key itself if no translation is found
  // — using ``defaultValue`` keeps the source string instead so
  // unknown departments (TMDB occasionally adds new ones) don't
  // surface raw keys to the user.
  return t(`actor.department.${department}`, { defaultValue: department });
}

/**
 * Biography paragraph with a CSS line-clamp at 4 lines and a
 * "Mais" / "Menos" toggle. Mirrors the synopsis pattern from
 * ``MovieDetail`` so the user gets a consistent expand-to-read
 * affordance across the app.
 */
function PersonBiography({ text, t }: { text: string; t: TFunction }) {
  const [expanded, setExpanded] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const BIO_LINES = 4;

  useEffect(() => {
    if (expanded) return;
    const el = ref.current;
    if (!el) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 1);
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text, expanded]);

  return (
    // Force ``textAlign: left`` for the prose itself even when the
    // surrounding header is centered (mobile column layout). A
    // centered bio paragraph reads weirdly — every line lands on a
    // different x-coordinate; left-align keeps it scannable while
    // the avatar / name / meta line stay centered above.
    <Box sx={{ mt: { xs: 1.5, md: 2 }, textAlign: "left" }}>
      <Typography
        ref={ref}
        variant="body2"
        sx={{
          fontSize: { xs: "0.85rem", md: "0.95rem" },
          lineHeight: 1.55,
          color: "text.primary",
          ...(expanded
            ? {}
            : {
                display: "-webkit-box",
                WebkitLineClamp: BIO_LINES,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }),
        }}
      >
        {text}
      </Typography>
      {overflows && (
        <Typography
          variant="body2"
          onClick={() => setExpanded(!expanded)}
          sx={{
            color: "primary.main",
            cursor: "pointer",
            mt: 1,
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: 0.5,
            display: "inline-block",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {expanded ? t("actor.bioLess") : t("actor.bioMore")}
        </Typography>
      )}
    </Box>
  );
}
