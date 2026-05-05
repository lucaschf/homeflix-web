import { useCallback, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { ArrowLeft, Check, Layers, ListPlus, Play, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  useCollection,
  useContinueWatching,
  useRequestCatalogInclusion,
  useSubscribeCatalogNotification,
  useToggleWatchlist,
  useWatchlist,
} from "../api/hooks";
import type { CollectionPart } from "../api/types";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

/**
 * Collection Detail page — opens when the user clicks the "Parte
 * de <name>" chip on a Movie Detail. Lists every part of a TMDB
 * franchise and merges in local catalog state so missing titles
 * surface the "Solicitar inclusão" / "Avisar quando chegar" CTAs.
 */
export function Collection() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { tmdbId: tmdbIdParam } = useParams<{ tmdbId: string }>();
  const tmdbId = tmdbIdParam ? Number(tmdbIdParam) : undefined;
  const { data: collection, isLoading, isError } = useCollection(tmdbId);
  useDocumentTitle(collection?.name);
  const { data: continueWatching } = useContinueWatching();
  const { data: watchlist } = useWatchlist();
  const toggleWatchlist = useToggleWatchlist();
  const subscribeNotify = useSubscribeCatalogNotification();
  const [bulkAddPending, setBulkAddPending] = useState(false);

  // Set of ``mov_xxx`` ids the user has progress on. Lets the hero
  // CTA distinguish "Continuar saga" (something already started)
  // from "Reproduzir saga" (saga is fresh) without waiting on a
  // batch-progress endpoint.
  const inProgressMovieIds = useMemo(
    () =>
      new Set(
        (continueWatching ?? [])
          .filter((item) => item.media_type === "movie")
          .map((item) => item.media_id),
      ),
    [continueWatching],
  );

  const yearStats = useMemo(() => {
    if (!collection) return null;
    const years = collection.parts
      .map((p) => p.year)
      .filter((y): y is number => typeof y === "number");
    if (years.length === 0) return null;
    const min = Math.min(...years);
    const max = Math.max(...years);
    return {
      label: min === max ? `${min}` : `${min} – ${max}`,
      span: max - min,
    };
  }, [collection]);

  const totalRuntimeSeconds = useMemo(() => {
    if (!collection) return 0;
    return collection.parts.reduce(
      (acc, p) => acc + (p.runtime_seconds ?? 0),
      0,
    );
  }, [collection]);

  const totalRuntimeFormatted = useMemo(() => {
    if (totalRuntimeSeconds <= 0) return null;
    const hours = Math.floor(totalRuntimeSeconds / 3600);
    const minutes = Math.floor((totalRuntimeSeconds % 3600) / 60);
    return `${hours}h${String(minutes).padStart(2, "0")}`;
  }, [totalRuntimeSeconds]);

  // The hero CTA picks a target part to play from:
  //   1. The first available part the user has already started — so
  //      "Continuar saga" actually resumes something concrete.
  //   2. Otherwise, the first available part — "Reproduzir saga"
  //      kicks off the franchise from the beginning.
  const firstAvailable = useMemo(() => {
    if (!collection) return undefined;
    const inProgress = collection.parts.find(
      (p) => p.in_catalog && p.movie_id && inProgressMovieIds.has(p.movie_id),
    );
    return (
      inProgress ?? collection.parts.find((p) => p.in_catalog && p.movie_id)
    );
  }, [collection, inProgressMovieIds]);

  const hasAnyProgress = useMemo(() => {
    if (!collection) return false;
    return collection.parts.some(
      (p) => p.in_catalog && p.movie_id && inProgressMovieIds.has(p.movie_id),
    );
  }, [collection, inProgressMovieIds]);

  // Set of media ids the user already has in the watchlist; used to
  // decide whether the "+ Lista" CTA still has work to do or is in
  // its terminal "Na lista" state.
  const watchlistIds = useMemo(
    () => new Set((watchlist ?? []).map((item) => item.media_id)),
    [watchlist],
  );

  // True when every part of the collection is "covered": available
  // titles already in the watchlist + missing titles already
  // subscribed to the arrival notification. This is the terminal
  // state for the "+ Lista" CTA.
  const isCollectionInList = useMemo(() => {
    if (!collection || !watchlist) return false;
    return collection.parts.every((p) => {
      if (p.in_catalog && p.movie_id) return watchlistIds.has(p.movie_id);
      if (!p.in_catalog) return p.notify_on_arrival;
      return true;
    });
  }, [collection, watchlist, watchlistIds]);

  const handleAddCollectionToList = useCallback(async () => {
    if (!collection || isCollectionInList || bulkAddPending) return;
    setBulkAddPending(true);
    try {
      const tasks: Promise<unknown>[] = [];
      for (const part of collection.parts) {
        if (part.in_catalog && part.movie_id) {
          // Skip toggle for movies already in the watchlist —
          // toggle would REMOVE them.
          if (!watchlistIds.has(part.movie_id)) {
            tasks.push(
              toggleWatchlist.mutateAsync({
                media_id: part.movie_id,
                media_type: "movie",
              }),
            );
          }
        } else if (!part.in_catalog && !part.notify_on_arrival) {
          tasks.push(
            subscribeNotify.mutateAsync({
              tmdb_id: part.tmdb_id,
              media_type: "movie",
              collection_tmdb_id: collection.tmdb_id,
            }),
          );
        }
      }
      await Promise.allSettled(tasks);
    } finally {
      setBulkAddPending(false);
    }
  }, [
    collection,
    isCollectionInList,
    bulkAddPending,
    watchlistIds,
    toggleWatchlist,
    subscribeNotify,
  ]);

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

  if (isError || !collection) {
    return (
      <Box sx={{ maxWidth: 720, mx: "auto", mt: 12, px: 3 }}>
        <Alert severity="error" variant="outlined">
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            {t("collection.errorTitle")}
          </Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            {t("collection.errorBody")}
          </Typography>
          <Button
            startIcon={<ArrowLeft size={16} />}
            onClick={() => navigate(-1)}
            sx={{ mt: 2 }}
          >
            {t("collection.back")}
          </Button>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ position: "relative", color: "text.primary" }}>
      <CollectionHero
        collection={collection}
        yearStats={yearStats}
        totalRuntime={totalRuntimeFormatted}
        firstAvailableMovieId={firstAvailable?.movie_id ?? null}
        hasAnyProgress={hasAnyProgress}
        isCollectionInList={isCollectionInList}
        bulkAddPending={bulkAddPending}
        onPlayFirstAvailable={() => {
          if (firstAvailable?.movie_id) {
            navigate(`/play/movie/${firstAvailable.movie_id}`);
          }
        }}
        onAddCollectionToList={handleAddCollectionToList}
      />

      <Box
        component="section"
        sx={{
          px: { xs: "22px", md: 6, lg: 10 },
          py: { xs: 3, md: 6 },
        }}
      >
        <Stack
          direction={{ xs: "column", md: "row" }}
          alignItems={{ xs: "flex-start", md: "baseline" }}
          justifyContent="space-between"
          sx={{ mb: 1 }}
          spacing={1.5}
        >
          <Typography
            component="h2"
            sx={{
              fontSize: { xs: "1.0625rem", md: "1.5rem" },
              fontWeight: 600,
              letterSpacing: "-0.015em",
              color: "text.primary",
              display: "inline-flex",
              alignItems: "baseline",
              gap: { xs: 1, md: 1.5 },
            }}
          >
            {t("collection.filmsHeader")}
            <Box
              component="span"
              sx={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: { xs: "0.6875rem", md: "0.8125rem" },
                color: "text.secondary",
                fontWeight: 400,
              }}
            >
              {collection.parts.length}
            </Box>
          </Typography>
          <Typography
            sx={{
              fontSize: { xs: "0.6875rem", md: "0.75rem" },
              color: "text.secondary",
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {t("collection.ordering")}
          </Typography>
        </Stack>

        <Box>
          {collection.parts.map((part, index) => (
            <FilmRow
              key={`${part.tmdb_id}-${index}`}
              part={part}
              index={index}
              isLast={index === collection.parts.length - 1}
              collectionTmdbId={collection.tmdb_id}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}

interface CollectionHeroProps {
  collection: NonNullable<ReturnType<typeof useCollection>["data"]>;
  yearStats: { label: string; span: number } | null;
  totalRuntime: string | null;
  firstAvailableMovieId: string | null;
  hasAnyProgress: boolean;
  isCollectionInList: boolean;
  bulkAddPending: boolean;
  onPlayFirstAvailable: () => void;
  onAddCollectionToList: () => void;
}

function CollectionHero({
  collection,
  yearStats,
  totalRuntime,
  firstAvailableMovieId,
  hasAnyProgress,
  isCollectionInList,
  bulkAddPending,
  onPlayFirstAvailable,
  onAddCollectionToList,
}: CollectionHeroProps) {
  const { t } = useTranslation();
  const missingCount = collection.missing_parts;
  const hasMissing = missingCount > 0;
  const sagaComplete = !firstAvailableMovieId;
  const ctaKey = sagaComplete
    ? "collection.sagaComplete"
    : hasAnyProgress
      ? "collection.continueSaga"
      : "collection.playSaga";
  const listCtaKey = bulkAddPending
    ? "collection.addingToList"
    : isCollectionInList
      ? "collection.inList"
      : "collection.addToList";

  return (
    <Box component="section" sx={{ position: "relative" }}>
      {/* Backdrop — on xs the hero is a 4:5 portrait block (matches
        the mobile spec); md+ falls back to the 70dvh full-bleed
        landscape layout. */}
      <Box
        sx={{
          position: "relative",
          width: "100%",
          aspectRatio: { xs: "4 / 5", md: "auto" },
          height: { xs: "auto", md: "70dvh" },
          minHeight: { md: 420 },
          overflow: "hidden",
        }}
      >
        {collection.backdrop_url ? (
          <Box
            component="img"
            src={collection.backdrop_url}
            alt=""
            sx={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "center top",
            }}
          />
        ) : (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              background:
                "radial-gradient(ellipse at 30% 40%, rgba(40,80,60,0.45), transparent 50%), radial-gradient(ellipse at 80% 70%, rgba(20,40,30,0.7), transparent 60%), linear-gradient(180deg, #0a1410 0%, #0a0a0a 100%)",
            }}
          />
        )}
        {/* Bottom fade so the title sits on a darker base regardless of backdrop. */}
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(180deg, rgba(10,10,10,0.35) 0%, rgba(10,10,10,0.15) 30%, rgba(10,10,10,0.7) 75%, #0D0D0D 100%)",
          }}
        />

        {/* Title block — bottom-anchored. xs (mobile spec) is
          inset 22px from the hero edges; md+ is a 55dvh-tall flex
          container so its bottom edge lands at exactly 55dvh from
          the page top regardless of the backdrop height. Single
          xs/md split — sm inherits xs cleanly (no half-applied
          desktop sizing on tablet portrait). */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            top: { xs: "auto", md: 0 },
            bottom: { xs: 0, md: "auto" },
            height: { xs: "auto", md: "55dvh" },
            display: "flex",
            alignItems: "flex-end",
            px: { xs: "22px", md: 6, lg: 10 },
            pb: { xs: "22px", md: 0 },
          }}
        >
          <Box sx={{ maxWidth: { xs: "100%", md: 720 } }}>
            <Box
              sx={{
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: { xs: "0.625rem", md: "0.6875rem" },
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "primary.main",
                mb: { xs: 1.25, md: 1.5 },
                display: "inline-flex",
                alignItems: "center",
                gap: { xs: 0.875, md: 1 },
              }}
            >
              <Box
                component="span"
                aria-hidden
                sx={{ display: "inline-flex", alignItems: "center" }}
              >
                <Layers size={14} strokeWidth={2} />
              </Box>
              {t("collection.eyebrow")}
            </Box>
            <Typography
              component="h1"
              sx={{
                margin: 0,
                fontSize: { xs: "2.125rem", md: "3.75rem", lg: "4rem" },
                fontWeight: 600,
                letterSpacing: { xs: "-0.025em", md: "-0.03em" },
                lineHeight: 1.0,
                color: "text.primary",
              }}
            >
              {collection.name}
            </Typography>
            {collection.overview && (
              <Typography
                sx={{
                  mt: { xs: 1.5, md: 2.5 },
                  fontSize: { xs: "0.8125rem", md: "0.9375rem" },
                  lineHeight: { xs: 1.5, md: 1.6 },
                  color: "rgba(245,241,235,0.78)",
                  maxWidth: { xs: "100%", md: 580 },
                }}
              >
                {collection.overview}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>

      {/* Stat bar — overlaps the bottom of the backdrop so it sits
        right after the description (anchored at 55dvh) instead of
        waiting for the 70dvh hero to end. Same idiom as the body
        offset in ``MovieDetail``: pull up with negative ``mt`` and
        let the inner ``py`` provide breath. Cells align at their
        top so eyebrow labels line up regardless of sub-lines.
        Full-bleed (no max-width) per spec. */}
      {/* Stat bar — Grid container so the cells line up the same
        way at every breakpoint, instead of relying on flex-wrap to
        fall in line. xs splits the row into 3 stat cells (4/4/4 of
        a 12-col grid) plus a 12-col actions row below. md+ uses
        ``size="auto"`` so the cells size to content and the
        actions cluster grows to fill the remaining space. */}
      <Grid
        container
        spacing={{ xs: 1.5, md: 4 }}
        rowSpacing={{ xs: 2, md: 0 }}
        alignItems="flex-start"
        sx={{
          position: "relative",
          zIndex: 1,
          mt: { md: "-15dvh" },
          mx: 0,
          width: "100%",
          px: { xs: "22px", md: 6, lg: 10 },
          pt: { xs: 2, md: 3 },
          pb: { xs: 2, md: 3 },
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Grid size={{ xs: 4, md: "auto" }}>
          <StatCell
            label={t("collection.filmsLabel")}
            value={String(collection.total_parts)}
          />
        </Grid>
        <Grid size={{ xs: 4, md: "auto" }}>
          <StatCell
            label={t("collection.releaseLabel")}
            value={yearStats?.label ?? "—"}
            sub={
              yearStats && yearStats.span > 0
                ? t("collection.yearsSpan", { count: yearStats.span })
                : undefined
            }
          />
        </Grid>
        {totalRuntime && (
          <Grid
            size={{ xs: 0, md: "auto" }}
            sx={{ display: { xs: "none", md: "block" } }}
          >
            <StatCell
              label={t("collection.totalRuntime")}
              value={totalRuntime}
              sub={t("collection.filmsCount", { count: collection.total_parts })}
            />
          </Grid>
        )}
        <Grid size={{ xs: 4, md: "auto" }}>
          <StatCell
            label={t("collection.inCatalog")}
            value={t("collection.available", {
              available: collection.available_parts,
              total: collection.total_parts,
            })}
            sub={
              hasMissing
                ? t("collection.missing", { count: missingCount })
                : t("collection.allAvailable")
            }
            tone={hasMissing ? "warn" : "default"}
          />
        </Grid>
        <Grid
          size={{ xs: 12, md: "grow" }}
          sx={{
            display: "flex",
            gap: 1.25,
            justifyContent: { xs: "stretch", md: "flex-end" },
            alignItems: { md: "center" },
          }}
        >
          <Button
            variant="contained"
            color="primary"
            startIcon={<Play size={14} />}
            onClick={onPlayFirstAvailable}
            disabled={sagaComplete}
            sx={{
              fontSize: "0.8125rem",
              fontWeight: { xs: 700, md: 600 },
              px: { xs: 1.75, md: 2.25 },
              height: { xs: 44, md: 40 },
              borderRadius: 1,
              flex: { xs: 1, md: "0 0 auto" },
              minWidth: 0,
              whiteSpace: "nowrap",
            }}
          >
            {t(ctaKey)}
          </Button>
          <Button
            variant="outlined"
            onClick={onAddCollectionToList}
            disabled={bulkAddPending || isCollectionInList}
            sx={{
              fontSize: "0.8125rem",
              fontWeight: 500,
              px: { xs: 1.75, md: 2 },
              height: { xs: 44, md: 40 },
              borderRadius: 1,
              flex: { xs: "0 0 auto", md: "0 0 auto" },
              minWidth: 0,
              whiteSpace: "nowrap",
              color: isCollectionInList ? "primary.main" : "text.primary",
              borderColor: isCollectionInList
                ? "rgba(217,119,87,0.35)"
                : "divider",
              bgcolor: isCollectionInList
                ? "rgba(217,119,87,0.08)"
                : "rgba(255,255,255,0.06)",
              "&.Mui-disabled": {
                color: isCollectionInList ? "primary.main" : "text.secondary",
                borderColor: isCollectionInList
                  ? "rgba(217,119,87,0.35)"
                  : "divider",
                bgcolor: isCollectionInList
                  ? "rgba(217,119,87,0.08)"
                  : "rgba(255,255,255,0.04)",
              },
            }}
          >
            {t(listCtaKey)}
          </Button>
        </Grid>
      </Grid>
    </Box>
  );
}

interface StatCellProps {
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn";
}

function StatCell({ label, value, sub, tone = "default" }: StatCellProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 0.25, md: 0.4 } }}>
      <Box
        component="span"
        sx={{
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          fontSize: { xs: "0.53125rem", md: "0.5625rem" },
          letterSpacing: { xs: "0.16em", md: "0.18em" },
          textTransform: "uppercase",
          color: "text.secondary",
        }}
      >
        {label}
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: { xs: "0.9375rem", md: "1.0625rem" },
          fontWeight: 500,
          color: "text.primary",
          letterSpacing: "-0.01em",
        }}
      >
        {value}
      </Box>
      {sub && (
        <Box
          component="span"
          sx={{
            fontSize: { xs: "0.59375rem", md: "0.6875rem" },
            fontFamily: { xs: "'JetBrains Mono', ui-monospace, monospace", md: "inherit" },
            color: tone === "warn" ? "primary.main" : "text.secondary",
          }}
        >
          {sub}
        </Box>
      )}
    </Box>
  );
}

interface FilmRowProps {
  part: CollectionPart;
  index: number;
  isLast: boolean;
  collectionTmdbId: number;
}

function FilmRow({ part, index, isLast, collectionTmdbId }: FilmRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const requestMutation = useRequestCatalogInclusion();
  const subscribeMutation = useSubscribeCatalogNotification();

  const missing = !part.in_catalog;
  const number = String(index + 1).padStart(2, "0");
  const ariaLabel = missing
    ? t("collection.filmRowAriaUnavailable", { number: index + 1 })
    : t("collection.filmRowAriaUnwatched", { number: index + 1 });

  const posterSrc = part.local_poster_path ?? part.poster_url;

  const handleRowClick = () => {
    if (!missing && part.movie_id) {
      navigate(`/movie/${part.movie_id}`);
    }
  };

  const handleRequest = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (part.is_requested || requestMutation.isPending) return;
    requestMutation.mutate({
      tmdb_id: part.tmdb_id,
      media_type: "movie",
      collection_tmdb_id: collectionTmdbId,
    });
  };

  const handleNotify = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (part.notify_on_arrival || subscribeMutation.isPending) return;
    subscribeMutation.mutate({
      tmdb_id: part.tmdb_id,
      media_type: "movie",
      collection_tmdb_id: collectionTmdbId,
    });
  };

  const requestedDisplay =
    part.is_requested ||
    (requestMutation.isSuccess &&
      requestMutation.variables?.tmdb_id === part.tmdb_id);
  const notifyDisplay =
    part.notify_on_arrival ||
    (subscribeMutation.isSuccess &&
      subscribeMutation.variables?.tmdb_id === part.tmdb_id);

  return (
    <Box
      role={missing ? undefined : "button"}
      tabIndex={missing ? undefined : 0}
      aria-label={ariaLabel}
      onClick={handleRowClick}
      onKeyDown={(event) => {
        if (missing) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          handleRowClick();
        }
      }}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "36px 96px 1fr", md: "60px 200px 1fr" },
        gap: { xs: 1.5, md: 3.5 },
        alignItems: "stretch",
        py: { xs: 2, md: 3 },
        borderBottom: "1px solid",
        borderColor: "divider",
        cursor: missing ? "default" : "pointer",
        transition: "background-color 160ms ease",
        "&:hover": missing
          ? undefined
          : { bgcolor: "rgba(255,255,255,0.015)" },
        "&:focus-visible": missing
          ? undefined
          : {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: -2,
            },
      }}
    >
      {/* Order indicator + connector */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          position: "relative",
        }}
      >
        <Box
          sx={{
            width: { xs: 26, md: 32 },
            height: { xs: 26, md: 32 },
            borderRadius: "50%",
            border: missing
              ? "1px dashed rgba(255,255,255,0.18)"
              : "1px solid",
            borderColor: missing ? "transparent" : "divider",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: { xs: "0.625rem", md: "0.75rem" },
            fontWeight: 600,
            color: missing ? "rgba(245,241,235,0.35)" : "text.secondary",
            flexShrink: 0,
            zIndex: 2,
            bgcolor: "background.default",
          }}
        >
          {number}
        </Box>
        {!isLast && (
          <Box
            sx={{
              flex: 1,
              width: "1px",
              bgcolor: "divider",
              mt: 0.75,
            }}
          />
        )}
      </Box>

      {/* Poster */}
      <Box
        sx={{
          aspectRatio: "2/3",
          borderRadius: 1,
          overflow: "hidden",
          position: "relative",
          border: "1px solid",
          borderColor: "divider",
          bgcolor: missing ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.05)",
          filter: missing ? "grayscale(1)" : "none",
        }}
      >
        {posterSrc ? (
          <Box
            component="img"
            src={posterSrc}
            alt={part.title}
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: missing ? 0.6 : 1,
            }}
          />
        ) : (
          <Box
            sx={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 1.5,
              fontFamily: "serif",
              fontWeight: 700,
              fontSize: "0.75rem",
              textAlign: "center",
              color: missing ? "rgba(255,255,255,0.35)" : "rgba(255,255,255,0.85)",
              letterSpacing: "0.05em",
              textTransform: "uppercase",
            }}
          >
            {part.title}
          </Box>
        )}
        {missing && (
          <>
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "repeating-linear-gradient(135deg, transparent 0 8px, rgba(255,255,255,0.025) 8px 9px)",
                pointerEvents: "none",
              }}
            />
            <Box
              sx={{
                position: "absolute",
                top: { xs: 5, md: 8 },
                left: { xs: 5, md: 8 },
                right: { xs: 5, md: 8 },
                display: "flex",
                alignItems: "center",
                justifyContent: { xs: "center", md: "flex-start" },
                gap: 0.5,
                px: { xs: 0.625, md: 0.85 },
                py: { xs: 0.375, md: 0.4 },
                bgcolor: "rgba(0,0,0,0.65)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 0.75,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: { xs: "0.46875rem", md: "0.5625rem" },
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "rgba(245,241,235,0.7)",
              }}
            >
              <Box
                component="span"
                sx={{ fontSize: { xs: "0.5625rem", md: "0.6875rem" }, lineHeight: 1 }}
                aria-hidden
              >
                ✕
              </Box>
              {/* Spec uses the abbreviated "Indispon." on mobile; the
                desktop full label keeps "Indisponível". */}
              <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>
                {t("collection.unavailable")}
              </Box>
              <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>
                {t("collection.unavailableShort")}
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Info */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: { xs: 1, md: 1.5 },
          justifyContent: "space-between",
          minWidth: 0,
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: { xs: 0.875, md: 1.5 },
              mb: { xs: 0.5, md: 0.75 },
              flexWrap: "wrap",
            }}
          >
            <Typography
              component="h3"
              sx={{
                margin: 0,
                fontSize: { xs: "0.9375rem", md: "1.5rem" },
                fontWeight: 600,
                letterSpacing: { xs: "-0.01em", md: "-0.015em" },
                lineHeight: { xs: 1.2, md: 1.15 },
                color: missing ? "rgba(245,241,235,0.65)" : "text.primary",
              }}
            >
              {part.title}
            </Typography>
            {part.year != null && (
              <Box
                component="span"
                sx={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: { xs: "0.625rem", md: "0.6875rem" },
                  color: "text.secondary",
                }}
              >
                {part.year}
              </Box>
            )}
          </Box>

          {missing && (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: { xs: 0.5, md: 0.6 },
                px: { xs: 0.75, md: 1 },
                py: { xs: 0.25, md: 0.4 },
                mb: { xs: 0.75, md: 0 },
                bgcolor: "rgba(217,119,87,0.08)",
                border: "1px solid rgba(217,119,87,0.25)",
                borderRadius: 0.5,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                fontSize: { xs: "0.5rem", md: "0.5625rem" },
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "primary.main",
              }}
            >
              <Box
                component="span"
                sx={{
                  width: { xs: 4, md: 5 },
                  height: { xs: 4, md: 5 },
                  borderRadius: "50%",
                  bgcolor: "primary.main",
                }}
              />
              {t("collection.noCatalog")}
            </Box>
          )}

          {/* Meta line */}
          <Box
            sx={{
              display: "flex",
              gap: { xs: 0.875, md: 1.75 },
              alignItems: "center",
              fontSize: { xs: "0.65625rem", md: "0.75rem" },
              color: "text.secondary",
              mb: { xs: 0.75, md: 1.5 },
              flexWrap: "wrap",
            }}
          >
            {part.rating != null && (
              <Box
                component="span"
                sx={{ color: missing ? "text.secondary" : "primary.main" }}
              >
                ★ {part.rating.toFixed(1)}
              </Box>
            )}
            {part.runtime_formatted && (
              <>
                <Box component="span" sx={{ opacity: 0.4 }}>
                  ·
                </Box>
                <Box component="span">{part.runtime_formatted}</Box>
              </>
            )}
            <Box component="span" sx={{ opacity: 0.4 }}>
              ·
            </Box>
            <Box
              component="span"
              sx={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
            >
              {`${index + 1}º`}
            </Box>
          </Box>

          {part.synopsis && (
            <Typography
              sx={{
                margin: 0,
                fontSize: { xs: "0.71875rem", md: "0.8125rem" },
                lineHeight: { xs: 1.5, md: 1.65 },
                color: missing
                  ? "rgba(245,241,235,0.5)"
                  : "rgba(245,241,235,0.78)",
                maxWidth: 640,
                display: "-webkit-box",
                WebkitLineClamp: { xs: 3, md: 4 },
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {part.synopsis}
            </Typography>
          )}
        </Box>

        {/* Actions — on xs only the primary CTA is rendered (per
          mobile spec); md+ keeps the secondary "Avisar quando
          chegar" / "Detalhes →" alongside it. */}
        <Box sx={{ display: "flex", gap: { xs: 0.75, md: 1.25 }, alignItems: "center", flexWrap: "wrap", mt: { xs: 0.5, md: 0 } }}>
          {missing ? (
            <>
              <Button
                variant={requestedDisplay ? "outlined" : "contained"}
                color="primary"
                size="small"
                disabled={requestedDisplay || requestMutation.isPending}
                onClick={handleRequest}
                startIcon={
                  requestedDisplay ? <Check size={12} /> : <Plus size={12} />
                }
                sx={{
                  fontSize: { xs: "0.6875rem", md: "0.75rem" },
                  fontWeight: 600,
                  px: { xs: 1.375, md: 1.75 },
                  py: { xs: 0.625, md: 0.75 },
                  ...(requestedDisplay && {
                    bgcolor: "rgba(217,119,87,0.12)",
                    borderColor: "rgba(217,119,87,0.35)",
                    color: "primary.main",
                    "&.Mui-disabled": {
                      bgcolor: "rgba(217,119,87,0.12)",
                      color: "primary.main",
                      borderColor: "rgba(217,119,87,0.35)",
                    },
                  }),
                }}
              >
                {requestedDisplay
                  ? t("collection.requestRegistered")
                  : t("collection.requestInclusion")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                disabled={notifyDisplay || subscribeMutation.isPending}
                onClick={handleNotify}
                startIcon={notifyDisplay ? <Check size={14} /> : <ListPlus size={14} />}
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  px: 1.5,
                  py: 0.75,
                  color: notifyDisplay ? "primary.main" : "text.secondary",
                  borderColor: notifyDisplay ? "rgba(217,119,87,0.35)" : "divider",
                  "&.Mui-disabled": {
                    color: notifyDisplay ? "primary.main" : "text.secondary",
                    borderColor: notifyDisplay ? "rgba(217,119,87,0.35)" : "divider",
                  },
                }}
              >
                {notifyDisplay
                  ? t("collection.notifyEnabled")
                  : t("collection.notifyOnArrival")}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="contained"
                color="primary"
                size="small"
                startIcon={<Play size={12} />}
                onClick={(event) => {
                  event.stopPropagation();
                  if (part.movie_id) {
                    navigate(`/play/movie/${part.movie_id}`);
                  }
                }}
                sx={{
                  fontSize: { xs: "0.6875rem", md: "0.75rem" },
                  fontWeight: 600,
                  px: { xs: 1.375, md: 1.75 },
                  py: { xs: 0.625, md: 0.75 },
                }}
              >
                {t("collection.play")}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={(event) => {
                  event.stopPropagation();
                  if (part.movie_id) {
                    navigate(`/movie/${part.movie_id}`);
                  }
                }}
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  px: 1.5,
                  py: 0.75,
                  color: "text.secondary",
                  borderColor: "divider",
                }}
              >
                {`${t("collection.details")} →`}
              </Button>
            </>
          )}
        </Box>
      </Box>
    </Box>
  );
}
