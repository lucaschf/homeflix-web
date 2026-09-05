import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { Play, Clapperboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useIsInWatchlist, useToggleWatchlist } from "../api/hooks";
import { neutral } from "../theme/colors";
import { ACTION_BAR_HEIGHT, whiteAlpha, panelScrim } from "../theme/tokens";
import { formatGenreList } from "../utils/genreList";
import { MetaLine } from "./MetaLine";
import { TitleLogo } from "./TitleLogo";
import { TrailerDialog } from "./TrailerDialog";
import { useToast } from "./ToastProvider";
import { WatchlistIconButton } from "./WatchlistIconButton";

export interface HeroSlide {
  id: string;
  type: "movie" | "series";
  title: string;
  synopsis?: string | null;
  year?: number;
  duration?: string;
  genres?: string[];
  backdropUrl?: string | null;
  logoUrl?: string | null;
  contentRating?: string | null;
  trailerUrl?: string | null;
  /**
   * Genres (localized) that match the profile's watch history — why
   * the backend picked this title. Empty / absent means random filler
   * or a profile without history, and the reason badge stays hidden.
   */
  matchedGenres?: string[];
}

interface HeroBannerProps {
  slides: HeroSlide[];
  onPlay?: (slide: HeroSlide) => void;
  onDetails?: (slide: HeroSlide) => void;
  onAddToList?: (slide: HeroSlide) => void;
  autoPlayInterval?: number;
}

/**
 * The discreet "why this title" eyebrow above the hero title. Renders
 * nothing at all (no reserved space) when the slide wasn't picked from
 * the profile's history, so random hero slides look exactly as before.
 */
function RecommendationReason({ genres }: { genres: string[] }) {
  const { t } = useTranslation();
  const list = formatGenreList(genres, t("hero.listConjunction"));
  if (!list) return null;
  return (
    <Typography
      variant="eyebrow"
      data-testid="hero-recommendation-reason"
      sx={{ color: "text.secondary", mb: 1.5 }}
    >
      {t("hero.becauseYouWatch", { genres: list })}
    </Typography>
  );
}

export function HeroBanner({
  slides,
  onPlay,
  onDetails,
  onAddToList,
  autoPlayInterval = 8000,
}: HeroBannerProps) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(0);
  const [trailerOpen, setTrailerOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const toggleWatchlist = useToggleWatchlist();
  const { showToast } = useToast();

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

  // Clamp current if slides shrink. The setCurrent is a bounded
  // one-shot cascade (only when the slides array changes length),
  // and there's no pure derivation alternative since `current` is
  // also user-driven (swipe / dot click).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const slide = slides[current];
  // Hook must be called unconditionally (before any early return)
  // to satisfy the rules-of-hooks. When count is 0, `slide` is
  // undefined, so the hook receives "" and returns a no-op result.
  const { data: inWatchlist } = useIsInWatchlist(slide?.id ?? "");

  // When ``slides`` is still empty (the parent's featured query is
  // pending) we render a placeholder at the final dimensions
  // instead of returning null. Matches the live banner's
  // ``75dvh`` / ``minHeight: 500`` so the rows below don't shift
  // up by ~600px when the data arrives — the swap is a content
  // change, not a layout change. Subtle vertical gradient avoids
  // a flat black slab while staying out of the way visually.
  if (count === 0) {
    return (
      <Box
        aria-hidden
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: { xs: "4 / 5", md: "auto" },
          height: { md: "75dvh" },
          minHeight: { md: 500 },
          background:
            `linear-gradient(180deg, ${neutral[900]} 0%, ${panelScrim(1)} 70%, ${panelScrim(1)} 100%)`,
        }}
      />
    );
  }

  return (
    <Box
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      sx={{
        position: "relative",
        width: "100%",
        aspectRatio: { xs: "4 / 5", md: "auto" },
        height: { md: "75dvh" },
        minHeight: { md: 500 },
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
            bottom: { xs: 0, md: -250 },
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
          bottom: { xs: 0, md: -250 },
          background: {
            xs: `linear-gradient(to right, ${panelScrim(0.97)} 0%, ${panelScrim(0.75)} 50%, ${panelScrim(0.3)} 100%)`,
            md: `linear-gradient(to right, ${panelScrim(0.95)} 0%, ${panelScrim(0.6)} 40%, transparent 70%)`,
          },
        }}
      />
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: { xs: 0, md: -250 },
          background: {
            xs: `linear-gradient(to top, ${panelScrim(1)} 0%, ${panelScrim(0.95)} 8%, ${panelScrim(0.78)} 20%, ${panelScrim(0.5)} 35%, ${panelScrim(0.2)} 55%, transparent 75%)`,
            md: `linear-gradient(to top, ${panelScrim(1)} 0%, ${panelScrim(0.92)} 8%, ${panelScrim(0.7)} 18%, ${panelScrim(0.4)} 32%, ${panelScrim(0.15)} 50%, transparent 70%)`,
          },
        }}
      />

      {/* Content */}
      <Box
        sx={{
          position: "relative",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          px: { xs: 3, md: 6 },
          pb: { xs: 3, md: 22 },
          maxWidth: 600,
          zIndex: 1,
        }}
      >
        <RecommendationReason genres={slide.matchedGenres ?? []} />

        <TitleLogo
          logoUrl={slide.logoUrl}
          title={slide.title}
          onClick={onDetails ? () => onDetails(slide) : undefined}
        />

        <MetaLine
          contentRating={slide.contentRating ?? null}
          items={[slide.year, slide.duration]}
          genres={slide.genres ?? []}
        />

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
          <Button
            variant="cta"
            startIcon={<Play size={18} />}
            onClick={() => onPlay?.(slide)}
            sx={{ height: ACTION_BAR_HEIGHT, px: 3.25 }}
          >
            {t("hero.play")}
          </Button>
          <WatchlistIconButton
            active={!!inWatchlist}
            onClick={() => {
              toggleWatchlist.mutate(
                { media_id: slide.id, media_type: slide.type },
                {
                  onSuccess: (res) =>
                    showToast(
                      t(res.data.added ? "lists.addedToList" : "lists.removedFromList"),
                    ),
                },
              );
              onAddToList?.(slide);
            }}
            addLabel={t("lists.addToList")}
            removeLabel={t("lists.removeFromList")}
          />
          {slide.trailerUrl && (
            <Button
              variant="hairline"
              startIcon={<Clapperboard size={18} />}
              onClick={() => setTrailerOpen(true)}
              sx={{ height: ACTION_BAR_HEIGHT, px: 2 }}
            >
              {t("detail.trailer")}
            </Button>
          )}
        </Box>

        {/* Dot Indicators — positioned near the first list below */}
        {count > 1 && (
          <Box sx={{ display: "flex", gap: 0.75, mt: { xs: 3, md: 12 } }}>
          {slides.map((s, i) => (
            <Box
              key={s.id}
              role="button"
              aria-label={`Go to slide ${i + 1}`}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") goTo(i); }}
              onClick={() => goTo(i)}
              sx={{
                width: i === current ? 32 : 10,
                height: 10,
                borderRadius: 5,
                bgcolor: i === current ? "primary.main" : whiteAlpha(0.4),
                cursor: "pointer",
                transition: "all 300ms",
                "&:hover": { bgcolor: i === current ? "primary.main" : whiteAlpha(0.7) },
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
