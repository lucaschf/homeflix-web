import { useEffect, useRef, useState } from "react";
import { Box, CircularProgress } from "@mui/material";
import { useNavigate } from "react-router-dom";
import { useByGenre } from "../api/hooks";
import type { Genre } from "../api/types";
import { MediaCard } from "./MediaCard";
import { MediaCarousel } from "./MediaCarousel";

interface GenreCarouselProps {
  genre: Genre;
}

/**
 * One genre carousel that owns its own paginated query.
 *
 * Wraps the presentational `MediaCarousel` with the `useByGenre`
 * infinite hook and a "fetch when the right edge is near" loop. The
 * carousel forwards `fetchNextPage` to the underlying scroll-row
 * sentinel — see `MediaCarousel`'s `onLoadMore` prop for how the
 * IntersectionObserver is wired against the inner scroll container.
 *
 * Renders nothing when the genre is empty (e.g. every item was
 * soft-deleted) so the page doesn't show ghost carousels.
 */
export function GenreCarousel({ genre }: GenreCarouselProps) {
  const navigate = useNavigate();
  const { items, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useByGenre(
    genre.id,
  );

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", height: 240 }}>
        <CircularProgress color="primary" size={28} />
      </Box>
    );
  }

  if (items.length === 0) return null;

  return (
    <MediaCarousel
      title={genre.name}
      onSeeAll={() => navigate(`/browse?genre=${encodeURIComponent(genre.id)}`)}
      onLoadMore={() => {
        void fetchNextPage();
      }}
      hasMore={hasNextPage}
      loadingMore={isFetchingNextPage}
    >
      {items.map((item) => (
        <MediaCard
          key={`${item.type}:${item.id}`}
          title={item.title}
          year={item.year}
          imageUrl={item.poster_path ?? undefined}
          synopsis={item.synopsis ?? undefined}
          variant="poster"
          mediaId={item.id}
          mediaType={item.type}
          onPlay={() =>
            navigate(item.type === "movie" ? `/play/movie/${item.id}` : `/series/${item.id}`)
          }
          onClick={() =>
            navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`)
          }
        />
      ))}
    </MediaCarousel>
  );
}

interface LazyGenreCarouselProps {
  genre: Genre;
}

/**
 * Vertical lazy-mount wrapper around `GenreCarousel`.
 *
 * Reserves vertical space for the carousel and only mounts the
 * underlying `GenreCarousel` (which triggers the network request)
 * when the placeholder enters the viewport. Used by the Home and
 * Browse pages so a library with many genres doesn't fire a fetch
 * for every carousel on initial page load — only the ones near the
 * fold are loaded immediately, and the rest stream in as the user
 * scrolls down.
 */
export function LazyGenreCarousel({ genre }: LazyGenreCarouselProps) {
  const [isVisible, setIsVisible] = useState(false);
  const placeholderRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isVisible) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) setIsVisible(true);
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [isVisible]);

  if (isVisible) {
    return <GenreCarousel genre={genre} />;
  }

  // Placeholder reserves enough vertical space for a full carousel
  // (header + a row of poster cards) so the page doesn't reflow
  // when the real component mounts and IntersectionObserver doesn't
  // trip on a zero-height element.
  return <Box ref={placeholderRef} sx={{ minHeight: 280, mb: 4 }} />;
}
