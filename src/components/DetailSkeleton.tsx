import { Box, Skeleton } from "@mui/material";
import { CarouselSkeleton } from "./CarouselSkeleton";
import { neutral } from "../theme/colors";
import { panelScrim } from "../theme/tokens";

interface DetailSkeletonProps {
  /**
   * ``hero`` (default) mirrors the Movie / Series / Collection layout
   * (backdrop hero + title + actions + body + a carousel row).
   * ``person`` mirrors the Actor page (portrait + bio + filmography
   * grid). Both replace the bare centered spinner so the load reads as
   * a content swap instead of the whole page popping in at once — the
   * same treatment the carousels already use.
   */
  variant?: "hero" | "person";
}

export function DetailSkeleton({ variant = "hero" }: DetailSkeletonProps) {
  return variant === "person" ? <PersonSkeleton /> : <HeroSkeleton />;
}

function HeroSkeleton() {
  return (
    <Box aria-busy="true" sx={{ position: "relative" }}>
      {/* Backdrop hero with bottom-anchored title / meta / actions. */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          height: { xs: "56dvh", md: "70dvh" },
          minHeight: { xs: 400, md: 460 },
          overflow: "hidden",
          display: "flex",
          alignItems: "flex-end",
          px: { xs: 3, md: 6 },
          pb: { xs: 4, md: "12dvh" },
          background: `linear-gradient(180deg, ${neutral[900]} 0%, ${panelScrim(0.55)} 55%, ${neutral[950]} 100%)`,
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 600 }}>
          <Skeleton animation="wave" variant="rounded" width="70%" height={46} sx={{ mb: 2, borderRadius: 2 }} />
          <Skeleton animation="wave" variant="text" width="50%" height={20} sx={{ mb: 2.5 }} />
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Skeleton animation="wave" variant="rounded" width={150} height={46} sx={{ borderRadius: 1 }} />
            <Skeleton animation="wave" variant="rounded" width={46} height={46} sx={{ borderRadius: 1 }} />
            <Skeleton animation="wave" variant="rounded" width={110} height={46} sx={{ borderRadius: 1 }} />
          </Box>
        </Box>
      </Box>

      {/* Synopsis lines. */}
      <Box sx={{ px: { xs: 3, md: 6 }, pt: 3, maxWidth: 760 }}>
        <Skeleton animation="wave" variant="text" width="95%" />
        <Skeleton animation="wave" variant="text" width="88%" />
        <Skeleton animation="wave" variant="text" width="55%" />
      </Box>

      {/* Cast / related placeholder. */}
      <Box sx={{ mt: 2 }}>
        <CarouselSkeleton />
      </Box>
    </Box>
  );
}

function PersonSkeleton() {
  return (
    <Box aria-busy="true">
      {/* Portrait + bio — mirrors ``PersonHero``. */}
      <Box sx={{ px: { xs: 2, sm: 3, md: 10 }, pt: { xs: 4, md: "60px" }, pb: { xs: 3, md: "40px" } }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
            columnGap: { md: 7 },
            rowGap: { xs: 3, md: 0 },
            alignItems: "start",
            justifyItems: { xs: "center", md: "stretch" },
          }}
        >
          <Box sx={{ width: { xs: 200, sm: 240, md: 280 } }}>
            <Skeleton
              animation="wave"
              variant="rounded"
              sx={{ width: "100%", aspectRatio: "7 / 9", borderRadius: 1 }}
            />
          </Box>
          <Box sx={{ width: "100%" }}>
            <Skeleton animation="wave" variant="text" width={120} height={16} sx={{ mb: 1.5 }} />
            <Skeleton animation="wave" variant="text" width="60%" height={48} sx={{ mb: 2 }} />
            <Skeleton animation="wave" variant="text" width="40%" height={18} sx={{ mb: 2.5 }} />
            <Skeleton animation="wave" variant="text" width="95%" />
            <Skeleton animation="wave" variant="text" width="90%" />
            <Skeleton animation="wave" variant="text" width="70%" />
          </Box>
        </Box>
      </Box>

      {/* Filmography grid placeholder. */}
      <Box
        sx={{
          px: { xs: 2, md: 10 },
          display: "grid",
          gridTemplateColumns: {
            xs: "repeat(3, 1fr)",
            sm: "repeat(4, 1fr)",
            md: "repeat(5, 1fr)",
            lg: "repeat(6, 1fr)",
          },
          gap: { xs: 1.5, md: 2 },
        }}
      >
        {Array.from({ length: 12 }, (_, i) => (
          <Skeleton
            key={i}
            animation="wave"
            variant="rounded"
            sx={{ width: "100%", aspectRatio: "2/3", borderRadius: 1 }}
          />
        ))}
      </Box>
    </Box>
  );
}
