import { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CircularProgress,
  MenuItem,
  Select,
  Typography,
  type SelectChangeEvent,
} from "@mui/material";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMoviesByActor, usePerson } from "../api/hooks";
import type { MovieSummary, PersonBio } from "../api/types";
import { DetailSkeleton } from "../components/DetailSkeleton";
import { MediaCard } from "../components/MediaCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fontFamily, inkAlpha, peachAlpha, whiteAlpha } from "../theme/tokens";

type SortKey = "recent" | "oldest" | "title";

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
 * Person / Filmography page.
 *
 * Layout follows the design handoff's "Person Detail": a tall
 * portrait paired with an info column (eyebrow + big name + stat
 * strip + bio + "full bio" link), and a filmography section with
 * a sort dropdown and a poster grid that reuses the catalog
 * ``MediaCard`` for visual parity with Home / Browse.
 *
 * Data plumbing is unchanged from the previous version: name comes
 * from the route param (``/actor/:name``), bio from ``usePerson``
 * keyed by the optional TMDB id forwarded via ``location.state``,
 * and the filmography from ``useMoviesByActor`` (paginated).
 */
export function Actor() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { name: rawName } = useParams<{ name: string }>();

  const actorName = rawName ?? "";
  useDocumentTitle(actorName || undefined);

  const navState = location.state as
    | { profilePath?: string | null; tmdbId?: number | null }
    | null;
  const navProfilePath = navState?.profilePath ?? null;
  const navTmdbId = navState?.tmdbId ?? null;

  const { data: person } = usePerson(navTmdbId);
  const profilePath = person?.profile_path ?? navProfilePath;

  const {
    movies,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useMoviesByActor(actorName);

  const [sort, setSort] = useState<SortKey>("recent");
  const sortedMovies = useMemo(() => {
    const list = [...movies];
    if (sort === "recent") list.sort((a, b) => b.year - a.year);
    if (sort === "oldest") list.sort((a, b) => a.year - b.year);
    if (sort === "title") list.sort((a, b) => a.title.localeCompare(b.title));
    return list;
  }, [movies, sort]);

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
    return <DetailSkeleton variant="person" />;
  }

  return (
    <Box>
      <PersonHero
        person={person ?? null}
        actorName={actorName}
        profilePath={profilePath}
        movieCount={movies.length}
        t={t}
        lang={i18n.language}
      />
      <FilmographySection
        movies={sortedMovies}
        sort={sort}
        onSortChange={setSort}
        t={t}
        onPlay={(id) => navigate(`/play/movie/${id}`)}
        onOpen={(id) => navigate(`/movie/${id}`)}
      />
      <Box
        ref={sentinelRef}
        sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: 80, mt: 2 }}
      >
        {isFetchingNextPage && <CircularProgress color="primary" size={28} />}
      </Box>
    </Box>
  );
}

interface PersonHeroProps {
  person: PersonBio | null;
  actorName: string;
  profilePath: string | null;
  movieCount: number;
  t: TFunction;
  lang: string;
}

function PersonHero({ person, actorName, profilePath, movieCount, t, lang }: PersonHeroProps) {
  const department = person?.known_for_department
    ? localizedDepartment(person.known_for_department, t)
    : null;

  return (
    <Box
      component="section"
      sx={{
        position: "relative",
        // Match the spec's 60/80/40 padding on desktop, scale down on
        // mobile. The hero sits at the top of the page and the soft
        // peach radial below adds a hint of warmth without competing
        // with future hero imagery.
        px: { xs: 2, sm: 3, md: 10 },
        pt: { xs: 4, md: "60px" },
        pb: { xs: 3, md: "40px" },
      }}
    >
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 20% 30%, ${peachAlpha(0.08)}, transparent 50%)`,
          pointerEvents: "none",
        }}
      />

      <Box
        sx={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
          columnGap: { md: 7 },
          rowGap: { xs: 3, md: 0 },
          alignItems: "start",
          justifyItems: { xs: "center", md: "stretch" },
        }}
      >
        <PersonPortrait name={actorName} profilePath={profilePath} />

        <Box sx={{ width: "100%", textAlign: { xs: "center", md: "left" } }}>
          {department && (
            <Typography variant="eyebrow" sx={{ color: "text.secondary", mb: 1.5 }}>
              {department}
            </Typography>
          )}
          <Typography
            component="h1"
            sx={{
              fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
              fontSize: { xs: "2rem", sm: "2.5rem", md: "3.5rem" },
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 1.05,
              m: 0,
              color: "text.primary",
            }}
          >
            {actorName}
          </Typography>

          <StatStrip person={person} movieCount={movieCount} lang={lang} t={t} />

          {person?.biography && <PersonBiography text={person.biography} t={t} />}
        </Box>
      </Box>
    </Box>
  );
}

function PersonPortrait({ name, profilePath }: { name: string; profilePath: string | null }) {
  return (
    <Box
      sx={{
        width: { xs: 200, sm: 240, md: 280 },
        aspectRatio: "7 / 9",
        borderRadius: 1,
        overflow: "hidden",
        border: `1px solid ${whiteAlpha(0.08)}`,
        position: "relative",
        flexShrink: 0,
        // Warm radial fallback that matches the spec's placeholder
        // tone — visible only behind the initials when we have no
        // profile photo. With a photo, ``object-fit: cover`` covers
        // the whole tile and the gradient is hidden.
        background: "radial-gradient(circle at 35% 30%, #a07050, #2a2018)",
      }}
    >
      {profilePath ? (
        <Box
          component="img"
          src={profilePath}
          alt={name}
          sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
        />
      ) : (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "Georgia, serif",
            fontSize: 88,
            color: whiteAlpha(0.18),
          }}
        >
          {initialsFor(name)}
        </Box>
      )}
    </Box>
  );
}

interface StatStripProps {
  person: PersonBio | null;
  movieCount: number;
  lang: string;
  t: TFunction;
}

function StatStrip({ person, movieCount, lang, t }: StatStripProps) {
  const stats: { key: string; label: string; value: string; sub?: string }[] = [];

  if (person?.birthday) {
    const formatted = formatDate(person.birthday, lang);
    if (formatted) {
      stats.push({
        key: "born",
        label: t("actor.stat.born"),
        value: formatted,
        sub: person.place_of_birth ?? undefined,
      });
    }
  }

  if (person?.deathday && person.birthday) {
    const yearsLived = computeAgeYears(person.birthday, person.deathday);
    if (yearsLived != null) {
      stats.push({
        key: "lifespan",
        label: t("actor.stat.lifespan"),
        value: t("actor.ageYears", { count: yearsLived }),
      });
    }
  } else if (person?.birthday) {
    const age = computeAgeYears(person.birthday, null);
    if (age != null) {
      stats.push({
        key: "age",
        label: t("actor.stat.age"),
        value: t("actor.ageYears", { count: age }),
      });
    }
  }

  stats.push({
    key: "catalog",
    label: t("actor.stat.catalog"),
    value: movieCount === 0 ? t("actor.noMovies") : t("actor.movieCount", { count: movieCount }),
  });

  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: { xs: "center", md: "flex-start" },
        columnGap: { xs: 3, md: 4.5 },
        rowGap: 2,
        mt: 3,
        pb: 3,
        borderBottom: `1px solid ${whiteAlpha(0.08)}`,
      }}
    >
      {stats.map((s) => (
        <Stat key={s.key} label={s.label} value={s.value} sub={s.sub} />
      ))}
    </Box>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, minWidth: 0 }}>
      <Typography variant="eyebrow" sx={{ color: "text.secondary", fontSize: "0.5625rem" }}>
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: "1.125rem",
          fontWeight: 500,
          letterSpacing: "-0.01em",
          color: "text.primary",
          lineHeight: 1.25,
        }}
      >
        {value}
      </Typography>
      {sub && (
        <Typography variant="caption" sx={{ color: "text.secondary", fontSize: "0.6875rem" }}>
          {sub}
        </Typography>
      )}
    </Box>
  );
}

interface FilmographySectionProps {
  movies: MovieSummary[];
  sort: SortKey;
  onSortChange: (next: SortKey) => void;
  t: TFunction;
  onPlay: (movieId: string) => void;
  onOpen: (movieId: string) => void;
}

function FilmographySection({ movies, sort, onSortChange, t, onPlay, onOpen }: FilmographySectionProps) {
  const handleSort = (e: SelectChangeEvent) => onSortChange(e.target.value as SortKey);

  return (
    <Box
      component="section"
      sx={{
        px: { xs: 2, sm: 3, md: 10 },
        pt: { xs: 3, md: "36px" },
        pb: { xs: 4, md: "80px" },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: { xs: "flex-start", sm: "baseline" },
          justifyContent: "space-between",
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          component="h2"
          sx={{
            fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
            fontSize: { xs: "1.25rem", md: "1.375rem" },
            fontWeight: 600,
            letterSpacing: "-0.015em",
            m: 0,
            color: "text.primary",
          }}
        >
          {t("actor.filmography")}
          <Box
            component="span"
            sx={{
              ml: 1.5,
              fontFamily: fontFamily.mono,
              fontSize: "0.75rem",
              fontWeight: 400,
              color: "text.secondary",
            }}
          >
            {movies.length}
          </Box>
        </Typography>

        {movies.length > 1 && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="eyebrow" sx={{ color: "text.secondary" }}>
              {t("actor.sort.label")}
            </Typography>
            <Select
              value={sort}
              onChange={handleSort}
              size="small"
              variant="outlined"
              sx={{
                color: "text.primary",
                fontSize: "0.75rem",
                "& .MuiSelect-select": { py: 0.75, pl: 1.25, pr: 4 },
                "& .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.12) },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: whiteAlpha(0.24),
                },
              }}
            >
              <MenuItem value="recent">{t("actor.sort.recent")}</MenuItem>
              <MenuItem value="oldest">{t("actor.sort.oldest")}</MenuItem>
              <MenuItem value="title">{t("actor.sort.title")}</MenuItem>
            </Select>
          </Box>
        )}
      </Box>

      {movies.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
          {t("actor.emptyFilmography")}
        </Typography>
      ) : (
        <Box
          sx={{
            // Responsive ``auto-fill`` grid: the columns stretch (``1fr``)
            // to fill the row, so full rows never leave a trailing gap on
            // the right. The ``minmax`` floors roughly preserve the
            // intrinsic ``MediaCard`` sizes (200 / 240 / 280) used by the
            // Home / Browse / Series carousels. Cards are full-width so
            // each fills its grid cell.
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(2, 1fr)",
              sm: "repeat(auto-fill, minmax(180px, 1fr))",
              md: "repeat(auto-fill, minmax(200px, 1fr))",
              lg: "repeat(auto-fill, minmax(240px, 1fr))",
            },
            gap: { xs: 1.5, sm: 2, md: 2.25 },
          }}
        >
          {movies.map((movie) => (
            <MediaCard
              key={movie.id}
              title={movie.title}
              year={movie.year}
              imageUrl={movie.poster_path ?? undefined}
              synopsis={movie.synopsis ?? undefined}
              resolution={movie.resolution}
              hdr={movie.hdr}
              variant="poster"
              mediaId={movie.id}
              mediaType="movie"
              fullWidth
              onPlay={() => onPlay(movie.id)}
              onClick={() => onOpen(movie.id)}
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

/** Years between ``from`` (ISO date) and ``to`` (ISO date or now). */
function computeAgeYears(from: string, to: string | null): number | null {
  const start = new Date(`${from}T00:00:00`);
  const end = to ? new Date(`${to}T00:00:00`) : new Date();
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  let years = end.getFullYear() - start.getFullYear();
  const monthDelta = end.getMonth() - start.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && end.getDate() < start.getDate())) {
    years -= 1;
  }
  return years >= 0 ? years : null;
}

/** Format an ISO ``YYYY-MM-DD`` for the active locale. */
function formatDate(iso: string, lang: string): string | null {
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat(lang, {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(date);
  } catch {
    return iso;
  }
}

/** Map a TMDB department string to its localized label, with fallback. */
function localizedDepartment(department: string, t: TFunction): string {
  return t(`actor.department.${department}`, { defaultValue: department });
}

/**
 * Biography paragraph with a CSS line-clamp at 4 lines and an
 * eyebrow toggle (``Full biography`` / ``Less``) styled like the
 * detail page's "Mais detalhes" link so the expand affordance
 * matches across the app.
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
    <Box sx={{ mt: 3, textAlign: "left" }}>
      <Typography
        ref={ref}
        sx={{
          fontSize: { xs: "0.875rem", md: "0.9375rem" },
          lineHeight: 1.7,
          color: inkAlpha(0.78),
          maxWidth: 720,
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
          variant="eyebrow"
          onClick={() => setExpanded(!expanded)}
          sx={{
            color: "primary.main",
            cursor: "pointer",
            mt: 2.5,
            display: "inline-block",
            "&:hover": { opacity: 0.8 },
          }}
        >
          {expanded ? `← ${t("actor.bioLess")}` : `${t("actor.fullBio")} →`}
        </Typography>
      )}
    </Box>
  );
}
