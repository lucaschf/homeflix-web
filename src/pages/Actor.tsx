import { useEffect, useRef } from "react";
import { Avatar, Box, CircularProgress, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useMoviesByActor } from "../api/hooks";
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
 * exact name via ``useMoviesByActor``. The avatar in the header is
 * passed via ``location.state`` from ``CastCard`` so the navigation
 * doesn't have to refetch the source movie's cast just to render a
 * photo — when the user lands directly on the URL (bookmark, share)
 * the header gracefully degrades to initials.
 *
 * Grid + infinite scroll mirror ``Browse``'s ``GenreGrid`` so the
 * "browse a slice of the catalog" UX feels the same regardless of
 * the filter axis.
 */
export function Actor() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { name: rawName } = useParams<{ name: string }>();

  // ``useParams`` already decodes ``%20`` etc., so the value is the
  // actor's display name as the user would read it.
  const actorName = rawName ?? "";

  // Optional photo passed via ``CastCard``'s navigation state. Lives
  // on ``location.state`` so deep-linking still works (state is just
  // ``null`` then) and falls back to initials.
  const profilePath = (location.state as { profilePath?: string | null } | null)?.profilePath ?? null;

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
    <Box sx={{ pt: { xs: 4, md: 6 } }}>
      {/* Header — LordFlix-inspired layout: large avatar on the left,
        prominent name + meta on the right. The current header is
        intentionally sparse (just count) because biography / birth
        date / departments require the actor's TMDB person id which
        isn't persisted on the cast yet. That enrichment lands in a
        follow-up PR; the layout below already reserves the
        right-column space so plugging the new fields in won't
        require rearranging the page. */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: { xs: 2, md: 4 },
          px: { xs: 2, md: 6 },
          mb: { xs: 4, md: 6 },
        }}
      >
        <Avatar
          src={profilePath ?? undefined}
          alt={actorName}
          sx={{
            width: { xs: 96, md: 160 },
            height: { xs: 96, md: 160 },
            flexShrink: 0,
            bgcolor: "rgba(255,255,255,0.08)",
            fontSize: { xs: "1.75rem", md: "3rem" },
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
          }}
        >
          {initialsFor(actorName)}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "1.75rem", md: "2.75rem" },
              fontWeight: 700,
              lineHeight: 1.1,
              mb: { xs: 0.5, md: 1 },
            }}
          >
            {actorName}
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ fontSize: { xs: "0.85rem", md: "0.95rem" } }}
          >
            {movies.length === 0
              ? t("actor.noMovies")
              : t("actor.movieCount", { count: movies.length })}
          </Typography>
        </Box>
      </Box>

      {movies.length > 0 && (
        <>
          <Box sx={{ px: { xs: 2, md: 6 }, mb: { xs: 2, md: 3 } }}>
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
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(3, 1fr)",
                sm: "repeat(4, 1fr)",
                md: "repeat(5, 1fr)",
                lg: "repeat(6, 1fr)",
                xl: "repeat(7, 1fr)",
              },
              gap: { xs: 1, sm: 1.5, md: 2 },
              px: { xs: 2, md: 6 },
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
                fullWidth
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
