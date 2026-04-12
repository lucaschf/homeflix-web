import { Box, CircularProgress, IconButton, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface MediaCarouselProps {
  title: string;
  subtitle?: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
  // Infinite-scroll plumbing — opt-in. When `onLoadMore` is provided
  // the carousel mounts an internal sentinel at the right edge of the
  // scroll row and fires the callback whenever the user scrolls close
  // to it. Used by `GenreCarousel` to trigger `fetchNextPage` from
  // the per-genre infinite query.
  onLoadMore?: () => void;
  hasMore?: boolean;
  loadingMore?: boolean;
}

export function MediaCarousel({
  title,
  subtitle,
  onSeeAll,
  children,
  onLoadMore,
  hasMore = false,
  loadingMore = false,
}: MediaCarouselProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateArrows = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const overflows = el.scrollWidth > el.clientWidth + 10;
    setHasOverflow(overflows);
    setShowLeft(el.scrollLeft > 0);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }, []);

  const handleScroll = updateArrows;

  // Check overflow on mount, resize, and when children count changes
  const childCount = React.Children.count(children);
  useEffect(() => {
    updateArrows();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateArrows);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateArrows, childCount]);

  // Infinite-scroll trigger: when `onLoadMore` is provided AND the
  // sentinel at the right edge of the scroll row enters the
  // container's viewport (with a 400px buffer so the next page is
  // already in flight by the time the user reaches the visible
  // edge), fire the callback. We anchor the IntersectionObserver to
  // the inner scroll container so horizontal-scroll triggers it the
  // same way vertical-scroll triggers a normal infinite list.
  //
  // `childCount` is intentionally NOT in the dep array even though
  // appending new items changes how many cards sit before the
  // sentinel. The sentinel is the same DOM node before and after
  // the append (React keeps it mounted), so the observer is still
  // watching the right element. Re-creating the observer on every
  // append would burn cycles for nothing.
  const sentinelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return;
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { root, rootMargin: "0px 400px 0px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [onLoadMore, hasMore, loadingMore]);

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 3, md: 6 },
          mb: 1.5,
          gap: 2,
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="h2" noWrap>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" noWrap sx={{ mt: 0.25 }}>
              {subtitle}
            </Typography>
          )}
        </Box>
        {onSeeAll && hasOverflow && (
          <Typography
            variant="body2"
            onClick={onSeeAll}
            sx={{
              color: "primary.main",
              cursor: "pointer",
              flexShrink: 0,
              "&:hover": { textDecoration: "underline" },
            }}
          >
            {t("home.seeAll")} &gt;
          </Typography>
        )}
      </Box>

      {/* Scroll Container */}
      <Box sx={{ position: "relative", "&:hover .scroll-btn": { opacity: 1 } }}>
        {/* Left Arrow */}
        {showLeft && (
          <IconButton
            className="scroll-btn"
            onClick={() => scroll("left")}
            aria-label="Scroll left"
            sx={{
              position: "absolute",
              left: { xs: 0, md: 8 },
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              color: "rgba(255,255,255,0.7)",
              opacity: 0,
              transition: "opacity 200ms",
              "&:hover": { color: "#fff", bgcolor: "transparent" },
            }}
          >
            <ChevronLeft size={32} />
          </IconButton>
        )}

        {/* Right Arrow */}
        {showRight && (
          <IconButton
            className="scroll-btn"
            onClick={() => scroll("right")}
            aria-label="Scroll right"
            sx={{
              position: "absolute",
              right: { xs: 0, md: 8 },
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              color: "rgba(255,255,255,0.7)",
              opacity: 0,
              transition: "opacity 200ms",
              "&:hover": { color: "#fff", bgcolor: "transparent" },
            }}
          >
            <ChevronRight size={32} />
          </IconButton>
        )}

        {/* Scrollable Row */}
        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            display: "flex",
            gap: 1.5,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            px: { xs: 3, md: 6 },
          }}
        >
          {children}
          {onLoadMore && hasMore && (
            // Sentinel + loading spinner at the right edge of the
            // scroll row. The IntersectionObserver above watches the
            // sentinel relative to the scroll container so any
            // horizontal scroll close to the end fires `onLoadMore`.
            <Box
              ref={sentinelRef}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 80,
                flexShrink: 0,
              }}
            >
              {loadingMore && <CircularProgress color="primary" size={24} />}
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
