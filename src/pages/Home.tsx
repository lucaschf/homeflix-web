import { useMemo } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useClearProgress,
  useClearSeriesProgress,
  useContinueWatching,
  useFeatured,
  useGenres,
  useRecentlyAddedCatalog,
} from "../api/hooks";
import { CarouselSkeleton } from "../components/CarouselSkeleton";
import { LazyGenreCarousel } from "../components/GenreCarousel";
import { HeroBanner, type HeroSlide } from "../components/HeroBanner";
import { MediaCard } from "../components/MediaCard";
import { MediaCarousel } from "../components/MediaCarousel";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { peach } from "../theme/colors";
import { formatDuration } from "../utils/duration";
import { findResumeEpisode } from "../utils/resumeEpisode";

function formatRemaining(positionSeconds: number, durationSeconds: number): string {
  const remaining = Math.max(0, durationSeconds - positionSeconds);
  const minutes = Math.ceil(remaining / 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`;
  }
  return `${minutes} min`;
}

export function Home() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  // Home is the bare app name on the tab — no prefix.
  useDocumentTitle(undefined);
  const { data: genres, isLoading: genresLoading } = useGenres();
  const { data: continueWatching } = useContinueWatching();
  const clearProgress = useClearProgress();
  const clearSeriesProgress = useClearSeriesProgress();
  const { data: featured } = useFeatured("all");
  const { data: recentlyAdded } = useRecentlyAddedCatalog();

  // ``hasContent`` only flips to false once the genres query has
  // resolved with an empty list — while it's still loading we want
  // to keep the structural skeleton on screen, not the empty-state
  // CTA. Mixing those two would briefly flash "Welcome to HomeFlix"
  // every time the user reloads.
  const hasContent = (genres?.length ?? 0) > 0;

  const heroSlides: HeroSlide[] = useMemo(
    () =>
      (featured ?? []).map((f) => ({
        id: f.id,
        type: f.type,
        title: f.title,
        synopsis: f.synopsis,
        year: f.year,
        duration: f.duration_formatted ? formatDuration(f.duration_formatted) : undefined,
        genres: f.genres,
        backdropUrl: f.backdrop_path,
        logoUrl: f.logo_path,
        contentRating: f.content_rating,
        trailerUrl: f.trailer_url,
      })),
    [featured],
  );

  // Empty-state CTA only renders once the genres query has resolved
  // with zero rows — otherwise we'd flash it on every reload while
  // the request is in flight. The structural skeletons below cover
  // the loading window.
  if (!genresLoading && !hasContent) {
    return <EmptyState />;
  }

  return (
    <Box>
      {/* HeroBanner renders an internal placeholder at the same
          dimensions when ``slides`` is empty (featured query
          pending), so the carousels below don't shift up by ~600px
          when the data arrives. */}
      <HeroBanner
        slides={heroSlides}
        onPlay={(slide) => {
          if (slide.type === "movie") {
            navigate(`/play/movie/${slide.id}`);
            return;
          }
          // Series: resume the in-progress episode straight from the
          // hero when there is one; otherwise open the detail page,
          // which owns the first-episode / season picker.
          const resume = findResumeEpisode(continueWatching, slide.id);
          if (resume) {
            navigate(`/play/episode/${slide.id}/${resume.season}/${resume.episode}`);
          } else {
            navigate(`/series/${slide.id}`);
          }
        }}
        onDetails={(slide) => {
          if (slide.type === "movie") navigate(`/movie/${slide.id}`);
          else navigate(`/series/${slide.id}`);
        }}
      />

      {/* Pull the carousels up over the hero's gradient bleed. On
          mobile the hero is shorter and its slide dots sit close to
          the bottom edge, so a full -80px pull made the first
          carousel title collide with the dots — ease it to -32px
          there while keeping the deeper desktop overlap. */}
      <Box sx={{ mt: { xs: -4, md: -10 }, position: "relative", zIndex: 1 }}>
        {/* Continue Watching: skeleton while pending so the row
            below it (Recently Added / first genre) doesn't shift
            up by ~250px when the data lands. Empty resolved
            response stays hidden — no point reserving a row for
            zero items. */}
        {continueWatching === undefined ? (
          <CarouselSkeleton title={t("home.continueWatching")} variant="landscape" />
        ) : continueWatching.length > 0 ? (
          <MediaCarousel title={t("home.continueWatching")}>
            {continueWatching.map((item) => (
              <MediaCard
                key={item.media_id}
                title={
                  item.media_type === "episode" &&
                  item.series_title &&
                  item.season_number != null &&
                  item.episode_number != null
                    ? `${item.series_title} - S${String(item.season_number).padStart(2, "0")}E${String(item.episode_number).padStart(2, "0")}`
                    : item.title
                }
                imageUrl={item.backdrop_path ?? item.poster_path ?? undefined}
                progress={item.percentage}
                progressLabel={formatRemaining(item.position_seconds, item.duration_seconds)}
                variant="landscape"
                onDismiss={() => {
                  if (item.media_type === "episode" && item.series_id) {
                    clearSeriesProgress.mutate(item.series_id);
                  } else {
                    clearProgress.mutate(item.media_id);
                  }
                }}
                onClick={() => {
                  if (item.media_type === "movie") {
                    navigate(`/play/movie/${item.media_id}`);
                  } else if (
                    item.media_type === "episode" &&
                    item.series_id &&
                    item.season_number != null &&
                    item.episode_number != null
                  ) {
                    navigate(`/play/episode/${item.series_id}/${item.season_number}/${item.episode_number}`);
                  }
                }}
              />
            ))}
          </MediaCarousel>
        ) : null}

        {/* Recently Added — same loading-state treatment. */}
        {recentlyAdded === undefined ? (
          <CarouselSkeleton title={t("home.recentlyAdded")} />
        ) : recentlyAdded.length > 0 ? (
          <MediaCarousel title={t("home.recentlyAdded")}>
            {recentlyAdded.map((item) => (
              <MediaCard
                key={`${item.type}:${item.id}`}
                title={item.title}
                imageUrl={item.poster_path ?? undefined}
                year={item.year}
                synopsis={item.synopsis ?? undefined}
                mediaId={item.id}
                mediaType={item.type}
                onPlay={
                  item.type === "movie"
                    ? () => navigate(`/play/movie/${item.id}`)
                    : undefined
                }
                onClick={() =>
                  navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)
                }
              />
            ))}
          </MediaCarousel>
        ) : null}

        {/* Genres skeleton anchors the page while the
            ``useGenres`` request is pending — without it the row
            of LazyGenreCarousels appears suddenly once the genres
            list resolves, pushing nothing because hero/CW are
            already on screen, but causing perceived "page jumped
            in" on slow connections. Two placeholder rows is enough
            to fill the viewport without overcommitting. */}
        {genresLoading ? (
          <>
            <CarouselSkeleton />
            <CarouselSkeleton />
          </>
        ) : null}
        {(genres ?? []).map((genre) => (
          <LazyGenreCarousel key={genre.id} genre={genre} />
        ))}
      </Box>
    </Box>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "70vh",
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 3,
          bgcolor: "primary.alpha12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <Film size={32} color={peach.main} />
      </Box>
      <Typography variant="h1" gutterBottom>
        {t("empty.welcome")}
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
        {t("empty.description")}
      </Typography>
      <Button
        variant="contained"
        startIcon={<FolderOpen size={20} />}
        size="large"
        onClick={() => navigate("/settings")}
      >
        {t("empty.addLibrary")}
      </Button>
    </Box>
  );
}
