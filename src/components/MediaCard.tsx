import { useMemo, useState } from "react";
import { Box, IconButton, LinearProgress, Tooltip, Typography } from "@mui/material";
import { Bookmark, BookmarkCheck, ListPlus, Play, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useContinueWatching, useIsInWatchlist, useToggleWatchlist } from "../api/hooks";
import { AddToListDialog } from "./AddToListDialog";
import { useToast } from "./ToastProvider";
import { neutral } from "../theme/colors";
import { whiteAlpha, scrim } from "../theme/tokens";
import { CARD_WIDTH } from "./mediaCardDimensions";

interface MediaCardProps {
  title: string;
  imageUrl?: string;
  year?: number;
  progress?: number;
  /** Short label shown above the progress bar (e.g. "42 min left"). */
  progressLabel?: string;
  subtitle?: string;
  synopsis?: string;
  variant?: "poster" | "landscape" | "episode";
  fullWidth?: boolean;
  onClick?: () => void;
  /** When set, enables hover overlay with info and actions */
  mediaId?: string;
  mediaType?: "movie" | "series";
  onPlay?: () => void;
  /** When set, renders a dismiss (X) button on the card. Used by the
   *  "Continue Watching" row to let the user remove an item. */
  onDismiss?: () => void;
}

export function MediaCard({
  title,
  imageUrl,
  year,
  progress,
  progressLabel,
  subtitle,
  synopsis,
  variant = "poster",
  fullWidth = false,
  onClick,
  mediaId,
  mediaType,
  onPlay,
  onDismiss,
}: MediaCardProps) {
  const { t } = useTranslation();
  const aspectRatio = variant === "poster" ? "2/3" : "16/9";
  const hasActions = !!mediaId && !!mediaType;
  // A movie card can start playback straight from the carousel. Series
  // need an episode picked first, so their cards only ever open the
  // detail page — ``onPlay`` is left undefined for them and no play
  // button is shown. When present, a prominent centered play button
  // reveals on hover so pointer users can start playback without the
  // old tiny hover-only icon. Touch devices hide it (a persistent
  // badge on every poster cluttered the mobile lists) and play from
  // the detail page instead — a tap on the card opens details there.
  const canPlay = hasActions && !!onPlay;

  // Surface resume progress on movie cards outside Continue Watching:
  // when the caller didn't pass an explicit ``progress`` and this is a
  // movie, derive it from the (cached, app-wide) Continue Watching feed
  // so a half-watched movie shows a bar in genre / related / recently-
  // added rows too. React Query dedupes the query across every card.
  const { data: continueWatching } = useContinueWatching();
  const effectiveProgress = useMemo(() => {
    if (progress !== undefined) return progress;
    if (mediaType !== "movie" || !mediaId) return undefined;
    return continueWatching?.find(
      (item) => item.media_type === "movie" && item.media_id === mediaId,
    )?.percentage;
  }, [progress, mediaType, mediaId, continueWatching]);

  // Off-screen rendering skip for carousel cards. `content-visibility:
  // auto` lets the browser skip layout/paint for cards outside the
  // scroll viewport, so appending a full page of ~20 items no longer
  // paints every card at once mid-scroll. The `contain-intrinsic-size`
  // placeholder is only used until a card renders once — the `auto`
  // keyword then remembers the real measured size, so the carousel's
  // scrollWidth (which drives the arrows and the load-more sentinel)
  // stays accurate. Fixed-width carousel cards only; `fullWidth` cards
  // live in grids/detail pages where the container drives the width.
  //
  // Heights below are estimates: card width × aspect + ~44px for the
  // title/year block. Poster (2/3) ≈ width × 1.5; landscape/episode
  // (16/9) ≈ width × 0.5625. Widths mirror ``CARD_WIDTH`` — keep the
  // two in sync if the breakpoints change.
  const intrinsicSize =
    variant === "poster"
      ? {
          xs: "auto 140px auto 254px",
          sm: "auto 200px auto 344px",
          md: "auto 240px auto 404px",
          lg: "auto 280px auto 464px",
        }
      : {
          xs: "auto 240px auto 179px",
          sm: "auto 320px auto 224px",
          md: "auto 360px auto 246px",
          lg: "auto 400px auto 269px",
        };

  return (
    <Box
      sx={{
        position: "relative",
        cursor: "pointer",
        flexShrink: 0,
        minWidth: 0,
        overflow: "hidden",
        borderRadius: 1,
        width: fullWidth ? "100%" : CARD_WIDTH[variant === "poster" ? "poster" : "landscape"],
        ...(fullWidth
          ? null
          : { contentVisibility: "auto", containIntrinsicSize: intrinsicSize }),
        // Hover affordances (image zoom, info overlay, play button,
        // text swap) are gated to pointer devices. On touch there is no
        // hover, so a tap would otherwise get "stuck" revealing the
        // overlay instead of navigating — gating keeps a tap going
        // straight to the detail page (the overlay is also made
        // non-interactive on touch, see InfoOverlay).
        "@media (hover: hover)": {
          "&:hover .media-image": { transform: "scale(1.05)" },
          "&:hover .card-hover-overlay": { opacity: 1 },
          "&:hover .card-play": { opacity: 1 },
          ...(hasActions && {
            "&:hover .card-text": { opacity: 0 },
          }),
          ...(!hasActions && {
            "&:hover .play-overlay": { opacity: 1 },
          }),
        },
      }}
    >
      {/* Image — this is the card's keyboard-focusable navigation
          target (role/button + Enter/Space). It's the image wrapper
          rather than the whole card so the focusable element doesn't
          nest the overlay's real action buttons inside a role=button. */}
      <Box
        className={hasActions ? "card-image-wrapper" : undefined}
        onClick={onClick}
        role={onClick ? "button" : undefined}
        tabIndex={onClick ? 0 : undefined}
        aria-label={onClick ? title : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onClick();
                }
              }
            : undefined
        }
        sx={{
          position: "relative",
          aspectRatio,
          "&:focus-visible": {
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: "background.paper",
          mb: hasActions ? 0 : 0.5,
          transition: "all 250ms ease",
          zIndex: 0,
        }}
      >
        {imageUrl ? (
          <Box
            component="img"
            className="media-image"
            src={imageUrl}
            alt={title}
            // Defer offscreen fetches and hand decoding to a
            // background thread so a freshly-appended page of cards
            // doesn't block the main thread mid-scroll — the stutter
            // that only shows up when scrolling into freshly-loaded
            // items, never when scrolling back over decoded ones.
            loading="lazy"
            decoding="async"
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 250ms ease",
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
              background: `linear-gradient(135deg, ${neutral[800]} 0%, ${neutral[700]} 100%)`,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t("card.noImage")}
            </Typography>
          </Box>
        )}

        {/* Dismiss button — shown on continue-watching cards */}
        {onDismiss && (
          <IconButton
            size="small"
            aria-label={t("card.dismiss")}
            onClick={(e) => {
              e.stopPropagation();
              onDismiss();
            }}
            sx={{
              position: "absolute",
              top: 4,
              right: 4,
              zIndex: 2,
              bgcolor: scrim(0.6),
              color: "common.white",
              p: 0.5,
              "&:hover": { bgcolor: scrim(0.85) },
            }}
          >
            <X size={14} />
          </IconButton>
        )}

        {/* Simple play overlay (no-actions cards only) */}
        {!hasActions && (
          <Box
            className="play-overlay"
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: scrim(0.4),
              opacity: 0,
              transition: "opacity 200ms ease",
            }}
          >
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                bgcolor: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play size={20} color={neutral[950]} fill={neutral[950]} />
            </Box>
          </Box>
        )}

        {/* Progress bar + remaining time label */}
        {effectiveProgress !== undefined && effectiveProgress > 0 && (
          <>
            {progressLabel && (
              <Box
                sx={{
                  position: "absolute",
                  bottom: 8,
                  left: 8,
                  zIndex: 3,
                  bgcolor: scrim(0.7),
                  borderRadius: 0.75,
                  px: 0.75,
                  py: 0.25,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{ fontSize: "0.6rem", fontWeight: 600, color: "common.white" }}
                >
                  {progressLabel}
                </Typography>
              </Box>
            )}
            <LinearProgress
              variant="determinate"
              value={effectiveProgress}
              sx={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: 4,
                zIndex: 2,
                bgcolor: whiteAlpha(0.2),
                "& .MuiLinearProgress-bar": { bgcolor: "primary.main" },
              }}
            />
          </>
        )}
      </Box>

      {/* Title + Year — fades out on hover for action cards */}
      <Box
        className={hasActions ? "card-text" : undefined}
        onClick={onClick}
        sx={{
          transition: hasActions ? "opacity 250ms ease" : undefined,
          mt: 0.5,
        }}
      >
        <Typography
          variant="body2"
          noWrap
          sx={{ fontWeight: 500, color: "text.primary", fontSize: "0.8rem", lineHeight: 1.3 }}
        >
          {title}
        </Typography>
        {(subtitle || year) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontSize: "0.7rem" }}>
            {subtitle || year}
          </Typography>
        )}
      </Box>

      {/* Full-card hover overlay (covers image + title area) */}
      {hasActions && (
        <InfoOverlay
          title={title}
          synopsis={synopsis}
          year={year}
          mediaId={mediaId}
          mediaType={mediaType}
          onClick={onClick}
        />
      )}

      {/* Primary play button — centered over the poster. Sits above
          the hover overlay (zIndex 3 > overlay's 1) so it's the click
          target for playback, while the rest of the card routes to the
          detail page. Revealed on hover on pointer devices; hidden on
          touch (a badge on every poster cluttered the mobile lists) —
          mobile plays from the detail page after a tap on the card. */}
      {canPlay && (
        <Box
          className="card-play"
          sx={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            aspectRatio,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 3,
            // The wrapper never intercepts clicks — only the button
            // does — so clicks off the button fall through to the card
            // (detail navigation).
            pointerEvents: "none",
            opacity: 0,
            transition: "opacity 200ms ease",
            // Touch devices have no hover to reveal the button and a
            // persistent one cluttered the poster lists — remove it
            // entirely there (no paint, no stray tap target); mobile
            // plays from the detail page instead.
            "@media (hover: none)": { display: "none" },
          }}
        >
          <Box
            component="button"
            type="button"
            aria-label={t("card.play")}
            onClick={(e) => {
              e.stopPropagation();
              onPlay?.();
            }}
            sx={{
              pointerEvents: "auto",
              border: "none",
              p: 0,
              cursor: "pointer",
              width: 48,
              height: 48,
              borderRadius: "50%",
              bgcolor: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: `0 2px 10px ${scrim(0.55)}`,
              transition: "transform 150ms ease, background-color 150ms ease",
              "&:hover": { transform: "scale(1.08)", bgcolor: "primary.dark" },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.light",
                outlineOffset: 2,
              },
            }}
          >
            <Play size={22} color={neutral[950]} fill={neutral[950]} />
          </Box>
        </Box>
      )}
    </Box>
  );
}

// ── Info Overlay (covers entire card on hover) ───────────

function InfoOverlay({
  title,
  synopsis,
  year,
  mediaId,
  mediaType,
  onClick,
}: {
  title: string;
  synopsis?: string;
  year?: number;
  mediaId: string;
  mediaType: "movie" | "series";
  onClick?: () => void;
}) {
  const { t } = useTranslation();
  const { data: inWatchlist } = useIsInWatchlist(mediaId);
  const toggleWatchlist = useToggleWatchlist();
  const { showToast } = useToast();
  const [addToListOpen, setAddToListOpen] = useState(false);

  return (
    <>
      <Box
        className="card-hover-overlay"
        onClick={onClick}
        sx={{
          position: "absolute",
          inset: 0,
          borderRadius: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          background: `linear-gradient(0deg, ${scrim(0.95)} 0%, ${scrim(0.8)} 50%, ${scrim(0.35)} 100%)`,
          opacity: 0,
          transition: "opacity 250ms ease",
          zIndex: 1,
          overflow: "hidden",
          // The overlay never reveals on touch (its opacity is only
          // lifted under `@media (hover: hover)`), so make it ignore
          // taps there — a tap then falls through to the image below
          // and navigates to the detail page instead of hitting the
          // invisible watchlist / add-to-list buttons.
          "@media (hover: none)": { pointerEvents: "none" },
        }}
      >
        {/* Info content */}
        <Box sx={{ p: 1.5 }}>
          <Typography
            variant="body2"
            sx={{ fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.3 }}
            noWrap
          >
            {title}
          </Typography>

          {year && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.7rem" }}>
              {year}
            </Typography>
          )}

          {synopsis && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: "-webkit-box",
                WebkitLineClamp: { xs: 2, sm: 3, md: 4, lg: 6 },
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                mt: 0.5,
                fontSize: "0.65rem",
                lineHeight: 1.4,
              }}
            >
              {synopsis}
            </Typography>
          )}

          {/* Secondary actions — watchlist + add-to-list. Playback is
              handled by the centered play button above, so no play
              icon here. */}
          <Box
            sx={{ display: "flex", gap: 0.5, mt: 1.5 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Tooltip title={inWatchlist ? t("card.removeFromWatchlist") : t("card.addToWatchlist")} arrow>
              <IconButton
                size="small"
                onClick={() =>
                  toggleWatchlist.mutate(
                    { media_id: mediaId, media_type: mediaType },
                    {
                      onSuccess: (res) =>
                        showToast(
                          t(res.data.added ? "lists.addedToList" : "lists.removedFromList"),
                        ),
                    },
                  )
                }
                sx={{ color: "primary.main" }}
              >
                {inWatchlist ? <BookmarkCheck size={18} /> : <Bookmark size={18} />}
              </IconButton>
            </Tooltip>

            <Tooltip title={t("card.addToList")} arrow>
              <IconButton
                size="small"
                onClick={() => setAddToListOpen(true)}
                sx={{ color: "primary.main" }}
              >
                <ListPlus size={18} />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      <AddToListDialog
        open={addToListOpen}
        onClose={() => setAddToListOpen(false)}
        mediaId={mediaId}
        mediaType={mediaType}
      />
    </>
  );
}
