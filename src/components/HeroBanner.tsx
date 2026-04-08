import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface HeroSlide {
  id: string;
  type: "movie" | "series";
  title: string;
  synopsis?: string | null;
  year?: number;
  duration?: string;
  genres?: string[];
  backdropUrl?: string | null;
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
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

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

  if (count === 0) return null;

  const slide = slides[current];

  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: "75dvh",
        minHeight: 500,
        overflow: "hidden",
      }}
    >
      {/* Backdrop Images — all rendered, only active visible */}
      {slides.map((s, i) => (
        <Box
          key={s.id}
          sx={{
            position: "absolute",
            inset: 0,
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

      {/* Gradient Overlays */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to right, rgba(13,13,13,0.95) 0%, rgba(13,13,13,0.6) 40%, transparent 70%)",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(to top, rgba(13,13,13,1) 0%, rgba(13,13,13,0.6) 25%, transparent 55%)",
        }}
      />

      {/* Navigation Arrows */}
      {count > 1 && (
        <>
          <IconButton
            aria-label="Previous slide"
            onClick={() => goTo(current - 1)}
            sx={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#fff",
              bgcolor: "rgba(0,0,0,0.3)",
              "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              zIndex: 2,
            }}
          >
            <ChevronLeft size={28} />
          </IconButton>
          <IconButton
            aria-label="Next slide"
            onClick={() => goTo(current + 1)}
            sx={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              color: "#fff",
              bgcolor: "rgba(0,0,0,0.3)",
              "&:hover": { bgcolor: "rgba(0,0,0,0.6)" },
              zIndex: 2,
            }}
          >
            <ChevronRight size={28} />
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
          pb: { xs: 10, md: 14 },
          maxWidth: 600,
          zIndex: 1,
        }}
      >
        <Typography
          variant="h1"
          sx={{ fontSize: { xs: "1.75rem", md: "2.25rem" }, fontWeight: 700, mb: 1 }}
        >
          {slide.title}
        </Typography>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5, flexWrap: "wrap" }}>
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
          <Button
            variant="outlined"
            startIcon={<Plus size={18} />}
            onClick={() => onAddToList?.(slide)}
            size="large"
            sx={{
              borderColor: "rgba(255,255,255,0.3)",
              color: "text.primary",
              "&:hover": { borderColor: "rgba(255,255,255,0.5)", bgcolor: "rgba(255,255,255,0.05)" },
            }}
          >
            {t("hero.myList")}
          </Button>
        </Box>
      </Box>

      {/* Dot Indicators */}
      {count > 1 && (
        <Box
          sx={{
            position: "absolute",
            bottom: 16,
            right: { xs: 16, md: 48 },
            display: "flex",
            gap: 1,
            zIndex: 2,
          }}
        >
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
  );
}
