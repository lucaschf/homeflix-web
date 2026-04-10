import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, Typography } from "@mui/material";
import { Bookmark, ChevronLeft, ChevronRight, Play, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsInWatchlist, useToggleWatchlist } from "../api/hooks";
import { ContentRatingBadge } from "./ContentRatingBadge";
import { TrailerDialog } from "./TrailerDialog";

export interface HeroSlide {
  id: string;
  type: "movie" | "series";
  title: string;
  synopsis?: string | null;
  year?: number;
  duration?: string;
  genres?: string[];
  backdropUrl?: string | null;
  contentRating?: string | null;
  trailerUrl?: string | null;
}

interface HeroBannerProps {
  slides: HeroSlide[];
  onPlay?: (slide: HeroSlide) => void;
  onAddToList?: (slide: HeroSlide) => void;
  autoPlayInterval?: number;
}

export function HeroBanner({
  slides,
  onPlay,
  onAddToList,
  autoPlayInterval = 8000,
}: HeroBannerProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toggleWatchlist = useToggleWatchlist();

  const count = slides.length;

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    if (count <= 1) return;
    timerRef.current = setInterval(() => {
      setCurrent((idx) => (idx + 1) % count);
    }, autoPlayInterval);
  }, [count, autoPlayInterval, clearTimer]);

  useEffect(() => {
    if (trailerOpen) {
      clearTimer();
    } else {
      startTimer();
    }
    return clearTimer;
  }, [startTimer, clearTimer, trailerOpen]);

  // Clamp current if slides shrink
  useEffect(() => {
    setCurrent((idx) => (count > 0 ? Math.min(idx, count - 1) : 0));
  }, [count]);

  const goTo = useCallback(
    (index: number) => {
      setCurrent(((index % count) + count) % count);
      startTimer();
    },
    [count, startTimer],
  );

  // Touch swipe support for mobile
  const touchStartX = useRef(0);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const delta = e.changedTouches[0].clientX - touchStartX.current;
      if (Math.abs(delta) > 50) {
        goTo(delta > 0 ? current - 1 : current + 1);
      }
    },
    [current, goTo],
  );

  if (count === 0) return null;

  const slide = slides[current];
  const { data: inWatchlist } = useIsInWatchlist(slide?.id ?? "");

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      sx={{
        position: "relative",
        width: "100%",
        height: "75dvh",
        minHeight: 500,
      }}
    >
      {/* Backdrop — extends beyond container to bleed under content below */}
      {slides.map((s, i) => (
        <Box
          key={s.id}
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: { xs: -200, md: -250 },
            opacity: i === current ? 1 : 0,
            transition: "opacity 800ms ease-in-out",
          }}
        >
          {s.backdropUrl && (
            <Box
              component="img"
              src={s.backdropUrl}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center top" }}
            />
          )}
        </Box>
      ))}

      {/* Gradient Overlays — extend with the backdrop */}
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: { xs: -200, md: -250 },
          background: {
            xs: "linear-gradient(to right, rgba(13,13,13,0.97) 0%, rgba(13,13,13,0.75) 50%, rgba(13,13,13,0.3) 100%)",
            md: "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.6) 40%, transparent 70%)",
          },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: { xs: -200, md: -250 },
          background: {
            xs: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.95) 8%, rgba(13,13,13,0.78) 20%, rgba(13,13,13,0.5) 35%, rgba(13,13,13,0.2) 55%, transparent 75%)",
            md: "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.92) 8%, rgba(13,13,13,0.7) 18%, rgba(13,13,13,0.4) 32%, rgba(13,13,13,0.15) 50%, transparent 70%)",
          },
        }}
      />

      {/* Navigation Arrows */}
      {count > 1 && (
        <>
          <IconButton
            aria-label="Previous slide"
            onClick={() => goTo(current - 1)}
            sx={{
              display: { xs: "none", sm: "flex" },
              position: "absolute",
              left: { sm: 4, md: 16 },
              top: { sm: "30%", lg: "45%" },
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.5)",
              "&:hover": { color: "#fff", bgcolor: "rgba(0,0,0,0.3)" },
              zIndex: 2,
            }}
          >
            <ChevronLeft size={32} />
          </IconButton>
          <IconButton
            aria-label="Next slide"
            onClick={() => goTo(current + 1)}
            sx={{
              display: { xs: "none", sm: "flex" },
              position: "absolute",
              right: { sm: 4, md: 16 },
              top: { sm: "30%", lg: "45%" },
              transform: "translateY(-50%)",
              color: "rgba(255,255,255,0.5)",
              "&:hover": { color: "#fff", bgcolor: "rgba(0,0,0,0.3)" },
              zIndex: 2,
            }}
          >
            <ChevronRight size={32} />
          </IconButton>
        </>
      )}

      {/* Content */}
      <Box
        sx={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          px: { xs: 3, md: 6 },
          pb: { xs: 8, md: 22 },
          maxWidth: 600,
          zIndex: 1,
        }}
      >
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: "1.5rem", sm: "1.75rem", md: "2.25rem" }, fontWeight: 700, mb: 1 }}
        >
          {slide.title}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
          {slide.contentRating && <ContentRatingBadge rating={slide.contentRating} />}
          {slide.year && (
            <Typography variant="body2" color="text.secondary">
              {slide.year}
            </Typography>
          )}
          {slide.duration && (
            <>
              <Typography variant="body2" color="text.secondary">|</Typography>
              <Typography variant="body2" color="text.secondary">{slide.duration}</Typography>
            </>
          )}
          {slide.genres?.map((genre) => (
            <Chip
              key={genre}
              label={genre}
              size="small"
              sx={{ bgcolor: "rgba(255,255,255,0.1)", color: "text.secondary", height: 22, fontSize: "0.7rem" }}
            />
          ))}
        </Box>

        {slide.synopsis && (
          <Typography
            variant="body1"
            color="text.secondary"
            sx={{
              mb: 3,
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {slide.synopsis}
          </Typography>
        )}

        <Box sx={{ display: "flex", gap: 1.5 }}>
          <Button variant="contained" startIcon={<Play size={18} />} onClick={() => onPlay?.(slide)} size="large">
            {t("hero.play")}
          </Button>
          <IconButton
            aria-label={t("hero.myList")}
            onClick={() => {
              toggleWatchlist.mutate({ media_id: slide.id, media_type: slide.type });
              onAddToList?.(slide);
            }}
            sx={{
              color: inWatchlist ? "primary.main" : "text.secondary",
              border: inWatchlist ? "1px solid" : "1px solid rgba(255,255,255,0.2)",
              borderColor: inWatchlist ? "primary.main" : undefined,
              borderRadius: 1.5,
              width: 42,
              height: 42,
              "&:hover": { color: inWatchlist ? "primary.main" : "text.primary", borderColor: inWatchlist ? "primary.main" : "rgba(255,255,255,0.4)" },
            }}
          >
            <Bookmark size={20} fill={inWatchlist ? "currentColor" : "none"} />
          </IconButton>
          {slide.trailerUrl && (
            <Button
              variant="outlined"
              startIcon={<Clapperboard size={18} />}
              onClick={() => setTrailerOpen(true)}
              sx={{
                color: "text.secondary",
                borderColor: "rgba(255,255,255,0.2)",
                "&:hover": { color: "text.primary", borderColor: "rgba(255,255,255,0.4)" },
                height: 42,
              }}
            >
              {t("detail.trailer")}
            </Button>
          )}
        </Box>

        {/* Dot Indicators — positioned near the first list below */}
        {count > 1 && (
          <Box sx={{ display: "flex", gap: 0.75, mt: { xs: 8, md: 12 } }}>
          {slides.map((s, i) => (
            <Box
              key={s.id}
              role="button"
              aria-label={`Go to slide ${i + 1}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") goTo(i); }}
              onClick={() => goTo(i)}
              sx={{
                width: i === current ? 24 : 8,
                height: 8,
                borderRadius: 4,
                bgcolor: i === current ? "primary.main" : "rgba(255,255,255,0.4)",
                cursor: "pointer",
                transition: "all 300ms",
                "&:hover": { bgcolor: i === current ? "primary.main" : "rgba(255,255,255,0.7)" },
              }}
            />
          ))}
          </Box>
        )}
      </Box>

      {/* Single trailer dialog — rendered once, controlled by current slide */}
      {slide.trailerUrl && (
        <TrailerDialog
          open={trailerOpen}
          onClose={() => setTrailerOpen(false)}
          url={slide.trailerUrl}
        />
      )}
    </Box>
  );
}
