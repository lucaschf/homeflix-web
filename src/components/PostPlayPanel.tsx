import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { Play, RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { UpNextItem } from "../hooks/useUpNext";
import { neutral } from "../theme/colors";
import { ACTION_BAR_HEIGHT, panelScrim, peachAlpha, scrim } from "../theme/tokens";

/** The single highlighted suggestion at the top of the panel. */
export interface PostPlayHero {
  title: string;
  subtitle?: string;
  synopsis?: string;
  /** Landscape artwork — falls back to the poster when absent. */
  imageUrl?: string;
  /** Label for the primary button ("Play" / "Next episode"). */
  ctaLabel: string;
  onPlay: () => void;
}

interface PostPlayPanelProps {
  /**
   * True once the video actually reached its end. Only changes the
   * copy: the panel keeps the same geometry so the transition from
   * "credits rolling" to "finished" isn't a visual jump.
   */
  ended: boolean;
  hero: PostPlayHero | null;
  items: UpNextItem[];
  /** Localized genre the filler suggestions came from, when any did. */
  genreName: string | null;
  loading: boolean;
  onSelect: (item: UpNextItem) => void;
  /**
   * Return to full-screen playback. `null` once playback has ended —
   * there is nothing left to go back to, so the button is dropped
   * rather than rendered inert.
   */
  onDismiss: (() => void) | null;
  onReplay: () => void;
  /** Leave the player for the title's detail page. */
  onExit: () => void;
}

/**
 * Netflix-style post-play surface.
 *
 * Rendered over the player once the end credits start: the video keeps
 * running, shrunk into the left of the viewport by the Player, and this
 * panel occupies the right side with what to watch next. Nothing here
 * auto-advances — every suggestion needs a click, which is the one
 * deliberate departure from the streaming-service default.
 *
 * There is no panel *edge*: the surface is a horizontal gradient that
 * starts transparent over the shrunken picture and reaches solid well
 * before the content column, so the film dissolves into the suggestions
 * instead of being walled off from them.
 *
 * The panel is intentionally independent of the player's control
 * auto-hide: it stays up until the user picks something or dismisses
 * it, so an idle mouse can't leave the screen with no affordance on it.
 */
export function PostPlayPanel({
  ended,
  hero,
  items,
  genreName,
  loading,
  onSelect,
  onDismiss,
  onReplay,
  onExit,
}: PostPlayPanelProps) {
  const { t } = useTranslation();
  // The hero is drawn from the suggestion list, so the grid below shows
  // everything after it.
  const gridItems = hero ? items.slice(1) : items;
  // Once the grid is nothing but genre filler, saying "more like this"
  // oversells it — name the genre instead, which is all the shared
  // signal there actually is.
  const gridLabel =
    genreName && gridItems.length > 0 && gridItems.every((item) => item.source === "genre")
      ? t("player.postPlay.moreInGenre", { genre: genreName })
      : t("player.postPlay.moreLikeThis");

  return (
    <>
      {/* Light dim over the whole viewport. Deliberately gentle — the
          gradient below does most of the separating, and a heavy scrim
          would just make the credits look muddy. */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          bgcolor: scrim(0.35),
          zIndex: 11,
          pointerEvents: "none",
          animation: "postplay-dim 500ms ease-out",
          "@keyframes postplay-dim": { from: { opacity: 0 }, to: { opacity: 1 } },
        }}
      />

      <Box
        sx={{
          position: "absolute",
          zIndex: 12,
          // Reaches well past the content column so the gradient has
          // room to fade in over the picture. Right column on desktop,
          // bottom sheet on phones — the two shapes the Player scales
          // the video into.
          top: { xs: "38%", md: 0 },
          right: 0,
          bottom: 0,
          left: { xs: 0, md: "auto" },
          width: { xs: "100%", md: "64%" },
          background: {
            xs: `linear-gradient(to bottom, transparent 0%, ${scrim(0.7)} 14%, ${panelScrim(0.97)} 30%)`,
            md: `linear-gradient(to right, transparent 0%, ${scrim(0.65)} 18%, ${panelScrim(0.96)} 38%, ${panelScrim(0.98)} 100%)`,
          },
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-start",
          gap: { xs: 2, md: 3 },
          // Percentage padding keeps the content column sitting on the
          // solid part of the gradient at any viewport width.
          pl: { xs: 3, md: "26%" },
          pr: { xs: 3, md: 6 },
          pt: { xs: 4, md: 4 },
          pb: { xs: 3, md: 4 },
          animation: "postplay-in 500ms cubic-bezier(0.4, 0, 0.2, 1)",
          "@keyframes postplay-in": {
            from: { opacity: 0, transform: "translateX(40px)" },
            to: { opacity: 1, transform: "translateX(0)" },
          },
          // Content stops widening past a comfortable reading measure —
          // on an ultra-wide display the column is far more than a
          // synopsis line should ever span.
          "& > *": { width: "100%", maxWidth: 880 },
          "@media (prefers-reduced-motion: reduce)": { animation: "none" },
        }}
      >
        {/* Eyebrow — where we are in the title, and that it counted. */}
        <Typography
          sx={{
            color: "text.secondary",
            textTransform: "uppercase",
            letterSpacing: "0.16em",
            fontSize: "0.6875rem",
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {ended ? t("player.postPlay.finished") : t("player.creditsRolling")}
          {" · "}
          {t("player.markedWatched")}
        </Typography>

        {/* Suggestions — scrolls independently so the footer actions
            stay pinned on short viewports. */}
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            overflowX: "hidden",
            display: "flex",
            flexDirection: "column",
            // A short list reads better centred against the credits than
            // clinging to the top of a mostly empty column. `safe` keeps
            // a list that *does* overflow scrollable from its first row
            // instead of clipping it above the scroll origin.
            justifyContent: "safe center",
          }}
        >
          <Box sx={{ width: "100%", flexShrink: 0 }}>
            {loading && items.length === 0 ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
                <CircularProgress color="primary" size={28} />
              </Box>
            ) : hero ? (
              <>
                <SectionLabel>
                  {items[0]?.source === "collection"
                    ? t("player.postPlay.nextInCollection")
                    : t("player.postPlay.upNext")}
                </SectionLabel>
                <HeroCard hero={hero} />

                {gridItems.length > 0 && (
                  <>
                    <SectionLabel sx={{ mt: 5 }}>{gridLabel}</SectionLabel>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
                        gap: 2.5,
                      }}
                    >
                      {gridItems.map((item, index) => (
                        <SuggestionCard
                          key={item.id}
                          item={item}
                          index={index}
                          onSelect={() => onSelect(item)}
                        />
                      ))}
                    </Box>
                  </>
                )}
              </>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
                {t("player.postPlay.noSuggestions")}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Footer actions */}
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, flexShrink: 0 }}>
          {onDismiss && (
            <Button variant="hairline" onClick={onDismiss} sx={secondaryActionSx}>
              {t("player.backToMovie")}
            </Button>
          )}
          <Button
            variant="hairline"
            onClick={onReplay}
            startIcon={<RotateCcw size={16} />}
            sx={secondaryActionSx}
          >
            {t("player.postPlay.watchAgain")}
          </Button>
          <Button variant="hairline" onClick={onExit} sx={secondaryActionSx}>
            {t("player.postPlay.details")}
          </Button>
        </Box>
      </Box>
    </>
  );
}

/**
 * Secondary actions use the canonical `hairline` control (ADR-001) —
 * only the scale is layered here, matching the detail page's action
 * bar so the player's end screen and the rest of the app read as the
 * same product.
 */
const secondaryActionSx = { height: ACTION_BAR_HEIGHT, px: 2.25 } as const;

function SectionLabel({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: Record<string, unknown>;
}) {
  return (
    <Typography
      sx={{
        display: "block",
        mb: 1.5,
        color: "text.secondary",
        fontSize: "0.6875rem",
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.14em",
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}

/**
 * The highlighted next title: landscape still on the left, metadata and
 * the single primary call to action on the right. No card chrome — the
 * artwork carries the block, the way a streaming rail does it.
 */
function HeroCard({ hero }: { hero: PostPlayHero }) {
  return (
    <Box
      onClick={hero.onPlay}
      sx={{
        display: "flex",
        gap: { xs: 2, md: 3 },
        cursor: "pointer",
        "&:hover .postplay-hero-img": { transform: "scale(1.06)" },
        "&:hover .postplay-hero-shot": {
          boxShadow: `0 16px 40px ${scrim(0.6)}`,
        },
        "&:hover .postplay-hero-veil": { opacity: 1 },
      }}
    >
      <Box
        className="postplay-hero-shot"
        sx={{
          position: "relative",
          width: { xs: 148, md: 300 },
          flexShrink: 0,
          aspectRatio: "16/9",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: neutral[900],
          transition: "box-shadow 260ms ease",
        }}
      >
        {hero.imageUrl && (
          <Box
            component="img"
            className="postplay-hero-img"
            src={hero.imageUrl}
            alt=""
            sx={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              transition: "transform 400ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          />
        )}
        <Box
          className="postplay-hero-veil"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: scrim(0.35),
            opacity: 0,
            transition: "opacity 240ms ease",
          }}
        >
          <Play size={30} color={neutral[50]} fill={neutral[50]} />
        </Box>
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        <Typography
          sx={{
            fontWeight: 700,
            fontSize: { xs: "1rem", md: "1.35rem" },
            lineHeight: 1.2,
            color: "overlayText.primary",
            // Franchise titles run long ("Cinderella II: Dreams Come
            // True"); truncating the headline mid-word is worse than
            // letting it take a second line.
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {hero.title}
        </Typography>
        {hero.subtitle && (
          <Typography
            sx={{ mt: 0.5, color: "text.secondary", fontSize: "0.8125rem", fontWeight: 500 }}
            noWrap
          >
            {hero.subtitle}
          </Typography>
        )}
        {hero.synopsis && (
          <Typography
            sx={{
              mt: 1,
              color: "text.secondary",
              fontSize: "0.8125rem",
              lineHeight: 1.5,
              display: { xs: "none", md: "-webkit-box" },
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {hero.synopsis}
          </Typography>
        )}
        {/* Canonical coral CTA (ADR-001), sized like the detail page's
            action bar. `mt` is a real gap rather than `auto` so the
            button never ends up flush against the synopsis when the
            text happens to fill the block. */}
        <Button
          variant="cta"
          startIcon={<Play size={16} />}
          onClick={(e) => {
            e.stopPropagation();
            hero.onPlay();
          }}
          sx={{
            mt: 2.5,
            alignSelf: "flex-start",
            height: ACTION_BAR_HEIGHT,
            px: 3.25,
            boxShadow: `0 2px 6px ${peachAlpha(0.2)}`,
          }}
        >
          {hero.ctaLabel}
        </Button>
      </Box>
    </Box>
  );
}

/**
 * A poster in the "more like this" grid. Cards fade in staggered so the
 * row assembles rather than snapping into place all at once.
 */
function SuggestionCard({
  item,
  index,
  onSelect,
}: {
  item: UpNextItem;
  index: number;
  onSelect: () => void;
}) {
  return (
    <Box
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      sx={{
        cursor: "pointer",
        minWidth: 0,
        outline: "none",
        animation: "postplay-card-in 420ms cubic-bezier(0.4, 0, 0.2, 1) both",
        animationDelay: `${120 + index * 70}ms`,
        "@keyframes postplay-card-in": {
          from: { opacity: 0, transform: "translateY(14px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        "&:hover .postplay-poster, &:focus-visible .postplay-poster": {
          transform: "scale(1.05)",
          boxShadow: `0 14px 32px ${scrim(0.65)}`,
        },
        "&:focus-visible .postplay-poster": {
          outline: `2px solid ${peachAlpha(0.9)}`,
          outlineOffset: 2,
        },
        "&:hover .postplay-play, &:focus-visible .postplay-play": { opacity: 1 },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      <Box
        className="postplay-poster"
        sx={{
          position: "relative",
          aspectRatio: "2/3",
          borderRadius: 1,
          overflow: "hidden",
          bgcolor: neutral[900],
          transition: "transform 280ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 280ms ease",
        }}
      >
        {item.posterUrl && (
          <Box
            component="img"
            src={item.posterUrl}
            alt=""
            loading="lazy"
            decoding="async"
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
        <Box
          className="postplay-play"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: `linear-gradient(to top, ${scrim(0.7)}, ${scrim(0.25)})`,
            opacity: 0,
            transition: "opacity 240ms ease",
          }}
        >
          {/* Same coral disc MediaCard uses for its play affordance. */}
          <Box
            sx={{
              width: 44,
              height: 44,
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
      </Box>
      <Typography
        noWrap
        sx={{
          display: "block",
          mt: 1,
          fontWeight: 600,
          fontSize: "0.8125rem",
          color: "overlayText.primary",
        }}
      >
        {item.title}
      </Typography>
      {item.subtitle && (
        <Typography
          noWrap
          sx={{ display: "block", color: "text.secondary", fontSize: "0.75rem" }}
        >
          {item.subtitle}
        </Typography>
      )}
    </Box>
  );
}
