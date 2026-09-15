import {
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import { Box, ButtonBase, Collapse, Typography, useMediaQuery, useTheme } from "@mui/material";
import type { TFunction } from "i18next";
import { ChevronDown, Info, Infinity as InfinityIcon } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { border, whiteAlpha } from "../../theme/tokens";
import { ContentRatingBadge } from "../ContentRatingBadge";
import { selectionAccent } from "./selectionAccent";

/**
 * Age steps the ladder offers below "unrestricted" (ADR-035, D7): ``0`` is
 * "L" (all audiences), then the age ratings up to 16. The API accepts any
 * age from 0 to 21.
 */
const MATURITY_LIMIT_AGES = [0, 10, 12, 14, 16];

/**
 * The age a title without a rating requires: the backend resolves it to
 * ``AgeRating.ADULT``, so only a limit from 18 up reaches unrated titles.
 */
const UNRATED_AGE = 18;

/** The ClassInd scale, with the age each rating requires. */
const CLASSIND_RATINGS = [
  { label: "L", age: 0 },
  { label: "10", age: 10 },
  { label: "12", age: 12 },
  { label: "14", age: 14 },
  { label: "16", age: 16 },
  { label: "18", age: 18 },
];

/** Description per offered step; any other age reads as a custom limit. */
const STEP_DESCRIPTION_KEYS: Record<number, string> = {
  0: "profileManagement.fields.maturityLimitAllAgesDescription",
  10: "profileManagement.fields.maturityLimitUpTo10Description",
  12: "profileManagement.fields.maturityLimitUpTo12Description",
  14: "profileManagement.fields.maturityLimitUpTo14Description",
  16: "profileManagement.fields.maturityLimitUpTo16Description",
};

/** Tile side on the ladder and in the detail row; below ``md`` the ladder uses the compact one. */
const TILE_SIZE = 40;
const COMPACT_TILE_SIZE = 28;

/**
 * Room the rail leaves on each side of a tile: the selection ring's reach
 * (2px offset + 2px width), so the rail meets the ring instead of crossing it.
 */
const RAIL_TILE_GAP = 4;

/** Kept in the accessibility tree and focusable, out of sight. */
const VISUALLY_HIDDEN: CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  padding: 0,
  margin: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
};

/**
 * Whether a profile limited to ``limit`` sees a title requiring ``age``,
 * the same comparison the backend's ``AgeRating.allows`` makes.
 */
const allows = (limit: number | null, age: number) => limit === null || age <= limit;

/**
 * The ladder's steps, lowest first: the offered ages plus any other age
 * given (a limit stored outside the steps), in order, then ``null`` for
 * unrestricted.
 */
function ladderSteps(...extraAges: (number | null)[]): (number | null)[] {
  const ages = new Set(MATURITY_LIMIT_AGES);
  for (const age of extraAges) if (age !== null) ages.add(age);
  return [...[...ages].sort((a, b) => a - b), null];
}

const stepKey = (limit: number | null) => (limit === null ? "unrestricted" : String(limit));

/** "Unrestricted", "All ages" or "Up to age 12": the step's name and the slider's value text. */
const stepTitle = (t: TFunction, limit: number | null) =>
  limit === null
    ? t("profileManagement.fields.maturityLimitUnrestricted")
    : limit === 0
      ? t("profileManagement.fields.maturityLimitAllAges")
      : t("profileManagement.fields.maturityLimitUpTo", { age: limit });

/** The short label under a ladder tile. */
const stepCaption = (t: TFunction, limit: number | null) =>
  limit === null
    ? t("profileManagement.fields.maturityLimitUnrestricted")
    : limit === 0
      ? t("profileManagement.fields.maturityLimitAllAges")
      : String(limit);

const stepDescription = (t: TFunction, limit: number | null) =>
  t(
    limit === null
      ? "profileManagement.fields.maturityLimitUnrestrictedDescription"
      : (STEP_DESCRIPTION_KEYS[limit] ?? "profileManagement.fields.maturityLimitCustomDescription"),
  );

/**
 * What a limit keeps out of the catalog: the ClassInd ratings above it and
 * unrated titles, or the whole catalog for a limit from 18 up. Unrestricted
 * has no line, its description already says it.
 */
function catalogReach(t: TFunction, limit: number | null): string | null {
  if (limit === null) return null;
  if (allows(limit, UNRATED_AGE)) return t("profileManagement.fields.maturityLimitSeesAll");
  const blocked = CLASSIND_RATINGS.filter((rating) => !allows(limit, rating.age))
    .map((rating) => rating.label)
    .join(", ");
  return t("profileManagement.fields.maturityLimitBlocked", { blocked });
}

/** The step a key moves the selection to, or ``null`` when the key does not move it. */
function stepAfterKey(key: string, index: number, last: number): number | null {
  switch (key) {
    case "ArrowLeft":
    case "ArrowDown":
    case "PageDown":
      return Math.max(index - 1, 0);
    case "ArrowRight":
    case "ArrowUp":
    case "PageUp":
      return Math.min(index + 1, last);
    case "Home":
      return 0;
    case "End":
      return last;
    default:
      return null;
  }
}

interface MaturityLimitSelectorProps {
  /** The selected limit: a minimum age, or ``null`` for unrestricted. */
  value: number | null;
  /**
   * The limit the profile has stored. An age outside the offered steps
   * (set through the API) is placed on the ladder as an extra step, so it
   * shows as selected and stays reachable after the operator picks another.
   */
  storedLimit: number | null;
  onChange: (limit: number | null) => void;
  disabled?: boolean;
}

/**
 * Maturity limit picker for the profile form (ADR-035).
 *
 * A ladder of the ClassInd badges from L to 16 ending in "unrestricted":
 * the operator drags, clicks a step or uses the arrow keys, Home and End
 * to pick the highest rating the profile may watch. The rail is filled up
 * to the selection and the steps beyond it are dimmed, which is what the
 * profile stops seeing. Under the ladder, a detail row names the selected
 * step and lists what stays out, and a "how ratings work" note (collapsed
 * at first) explains how US ratings map to ages, that unrated titles need
 * an 18+ or unrestricted profile, that loosening the limit asks for the
 * parental PIN, and that video the server already cached is not covered.
 *
 * For assistive technology the ladder is one native range input named
 * after the heading, whose value text is the step title and whose
 * description is the detail row; the drawing itself is hidden.
 *
 * The component only reports the chosen limit through ``onChange``, and
 * only when it differs from ``value``; deciding whether that is a change
 * worth writing stays with the form.
 */
export function MaturityLimitSelector({
  value,
  storedLimit,
  onChange,
  disabled = false,
}: MaturityLimitSelectorProps) {
  const { t } = useTranslation();
  const labelId = useId();
  const descriptionId = useId();
  const reachId = useId();
  const steps = ladderSteps(storedLimit, value);
  const selectedIndex = steps.indexOf(value);
  const reach = catalogReach(t, value);

  const select = (index: number) => {
    const next = steps[index];
    if (next !== value) onChange(next);
  };

  return (
    <Box>
      <Typography id={labelId} variant="body2" sx={{ fontWeight: 600 }}>
        {t("profileManagement.fields.maturityLimit")}
      </Typography>
      <Typography variant="caption" sx={{ display: "block", color: "text.secondary", mt: 0.25 }}>
        {t("profileManagement.fields.maturityLimitHelp")}
      </Typography>
      <Box
        sx={{
          mt: 1.5,
          px: { xs: 1.5, md: 2.5 },
          pt: { xs: 2, md: 2.5 },
          pb: 2,
          borderRadius: 1.5,
          border: `1px solid ${border.hairlineStrong}`,
          bgcolor: whiteAlpha(0.02),
        }}
      >
        <MaturityLadder
          steps={steps}
          selectedIndex={selectedIndex}
          onSelect={select}
          disabled={disabled}
          labelId={labelId}
          describedBy={reach ? `${descriptionId} ${reachId}` : descriptionId}
          valueText={stepTitle(t, value)}
        />
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1.5,
            mt: 2,
            pt: 2,
            borderTop: `1px solid ${border.hairline}`,
          }}
        >
          <Box aria-hidden sx={{ display: "flex", flexShrink: 0 }}>
            <StepTile limit={value} size={TILE_SIZE} />
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: "text.primary" }}>
              {stepTitle(t, value)}
            </Typography>
            <Typography
              id={descriptionId}
              variant="caption"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {stepDescription(t, value)}
            </Typography>
            {reach && (
              <Typography
                id={reachId}
                variant="caption"
                sx={{ display: "block", color: "text.secondary", mt: 0.25 }}
              >
                {reach}
              </Typography>
            )}
          </Box>
        </Box>
      </Box>
      <HowItWorks />
    </Box>
  );
}

interface MaturityLadderProps {
  steps: (number | null)[];
  selectedIndex: number;
  onSelect: (index: number) => void;
  disabled: boolean;
  labelId: string;
  describedBy: string;
  valueText: string;
}

/**
 * The slider: a visually hidden range input over the step indexes, which
 * owns focus and the keyboard, and the drawn ladder, which takes the
 * pointer. A press on a tile picks that step; a press or drag anywhere
 * else snaps to the column under the pointer.
 */
function MaturityLadder({
  steps,
  selectedIndex,
  onSelect,
  disabled,
  labelId,
  describedBy,
  valueText,
}: MaturityLadderProps) {
  const { t } = useTranslation();
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down("md"));
  const tileSize = compact ? COMPACT_TILE_SIZE : TILE_SIZE;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const columnsRef = useRef<HTMLDivElement | null>(null);
  const dragging = useRef(false);
  const last = steps.length - 1;
  const accent = selectionAccent(theme);

  /** The step whose column holds ``clientX``, or ``null`` while nothing is laid out. */
  const indexAt = (clientX: number) => {
    const rect = columnsRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return null;
    const column = Math.floor(((clientX - rect.left) / rect.width) * steps.length);
    return Math.min(Math.max(column, 0), last);
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (disabled || event.button !== 0) return;
    const tile = (event.target as Element).closest<HTMLElement>("[data-step-index]");
    const index = tile ? Number(tile.dataset.stepIndex) : indexAt(event.clientX);
    // No text selection while dragging, and the keyboard picks up from here.
    event.preventDefault();
    inputRef.current?.focus({ preventScroll: true });
    event.currentTarget.setPointerCapture?.(event.pointerId);
    dragging.current = true;
    if (index !== null) onSelect(index);
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const index = indexAt(event.clientX);
    if (index !== null) onSelect(index);
  };

  const endDrag = () => {
    dragging.current = false;
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const index = stepAfterKey(event.key, selectedIndex, last);
    if (index === null) return;
    event.preventDefault();
    onSelect(index);
  };

  return (
    <Box
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      sx={{
        position: "relative",
        py: 0.5,
        borderRadius: 1,
        cursor: disabled ? "default" : "pointer",
        // Horizontal drags move the slider; vertical ones still scroll the dialog.
        touchAction: "pan-y",
        userSelect: "none",
        opacity: disabled ? 0.6 : 1,
        "&:has(input:focus-visible)": { outline: `2px solid ${accent}`, outlineOffset: 6 },
      }}
    >
      <input
        ref={inputRef}
        type="range"
        min={0}
        max={last}
        step={1}
        value={selectedIndex}
        disabled={disabled}
        aria-labelledby={labelId}
        aria-describedby={describedBy}
        aria-valuetext={valueText}
        onChange={(event) => onSelect(Number(event.target.value))}
        onKeyDown={handleKeyDown}
        style={VISUALLY_HIDDEN}
      />
      <Box
        ref={columnsRef}
        aria-hidden
        sx={{ display: "grid", gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((limit, index) => {
          const selected = index === selectedIndex;
          const dimmed = index > selectedIndex;
          return (
            <Box
              key={stepKey(limit)}
              data-step={stepKey(limit)}
              data-step-index={index}
              data-selected={selected || undefined}
              data-dimmed={dimmed || undefined}
              sx={{
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 1,
              }}
            >
              <Box
                sx={{
                  position: "relative",
                  alignSelf: "stretch",
                  display: "flex",
                  justifyContent: "center",
                }}
              >
                {index > 0 && (
                  <RailSegment side="left" filled={index <= selectedIndex} tileSize={tileSize} />
                )}
                {index < last && (
                  <RailSegment side="right" filled={index < selectedIndex} tileSize={tileSize} />
                )}
                <Box
                  sx={{
                    display: "flex",
                    borderRadius: "4px",
                    outline: selected ? `2px solid ${accent}` : "none",
                    outlineOffset: 2,
                    opacity: dimmed ? 0.35 : 1,
                    filter: dimmed ? "grayscale(1)" : "none",
                    transition: "opacity 150ms ease, filter 150ms ease",
                  }}
                >
                  <StepTile limit={limit} size={tileSize} />
                </Box>
              </Box>
              <Typography
                component="span"
                variant="caption"
                sx={{
                  lineHeight: 1.2,
                  whiteSpace: "nowrap",
                  fontWeight: selected ? 700 : 500,
                  color: selected ? "text.primary" : "text.secondary",
                  opacity: dimmed ? 0.6 : 1,
                  // Narrow screens name only the selected step; at the ends
                  // it is anchored to the edge so it never leaves the ladder.
                  display: { xs: selected ? "block" : "none", md: "block" },
                  alignSelf: {
                    xs: index === 0 ? "flex-start" : index === last ? "flex-end" : "center",
                    md: "center",
                  },
                }}
              >
                {stepCaption(t, limit)}
              </Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * Half of the rail inside one column, from the column edge to just short
 * of the tile, so it never shows through a dimmed tile. Neighbouring halves
 * meet at the column boundary.
 */
function RailSegment({
  side,
  filled,
  tileSize,
}: {
  side: "left" | "right";
  filled: boolean;
  tileSize: number;
}) {
  const towardTile = `calc(50% + ${tileSize / 2 + RAIL_TILE_GAP}px)`;
  return (
    <Box
      sx={(theme) => ({
        position: "absolute",
        top: "50%",
        height: 3,
        mt: "-1.5px",
        left: side === "left" ? 0 : towardTile,
        right: side === "left" ? towardTile : 0,
        bgcolor: filled ? selectionAccent(theme) : whiteAlpha(0.12),
        transition: "background-color 150ms ease",
      })}
    />
  );
}

/** The ClassInd badge for an offered age, or a neutral tile for unrestricted and custom ages. */
function StepTile({ limit, size }: { limit: number | null; size: number }) {
  if (limit === null) {
    return (
      <NeutralTile size={size}>
        <InfinityIcon size={Math.round(size * 0.55)} />
      </NeutralTile>
    );
  }
  if (STEP_DESCRIPTION_KEYS[limit]) {
    return <ContentRatingBadge rating={limit === 0 ? "L" : String(limit)} size={size} />;
  }
  return <NeutralTile size={size}>{limit}</NeutralTile>;
}

/** Badge-sized tile for steps without an official rating color. */
function NeutralTile({ size, children }: { size: number; children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        width: size,
        height: size,
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        bgcolor: whiteAlpha(0.08),
        border: `1px solid ${whiteAlpha(0.16)}`,
        color: "text.primary",
        fontWeight: 800,
        fontSize: size * 0.46,
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * How limits apply, kept next to the choice, with the cache caveat last.
 * The title is a disclosure button (collapsed at first) and the body stays
 * mounted, so the note keeps its name and text while it is closed.
 */
function HowItWorks() {
  const { t } = useTranslation();
  const titleId = useId();
  const panelId = useId();
  const [open, setOpen] = useState(false);

  return (
    <Box
      role="note"
      aria-labelledby={titleId}
      sx={{
        mt: 1.5,
        borderRadius: 1.25,
        border: `1px solid ${border.hairline}`,
        bgcolor: whiteAlpha(0.03),
      }}
    >
      <ButtonBase
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((current) => !current)}
        sx={{
          width: "100%",
          justifyContent: "flex-start",
          gap: 0.75,
          px: 1.5,
          py: 1,
          borderRadius: 1.25,
          color: "text.secondary",
          "&:hover": { bgcolor: whiteAlpha(0.03) },
          "&.Mui-focusVisible": {
            outline: (theme) => `2px solid ${theme.palette.primary.main}`,
            outlineOffset: 2,
          },
        }}
      >
        <Info size={14} />
        <Typography
          id={titleId}
          component="span"
          variant="caption"
          sx={{ fontWeight: 600, color: "text.primary" }}
        >
          {t("profileManagement.fields.maturityLimitHowItWorks")}
        </Typography>
        <Box
          component="span"
          sx={{
            display: "flex",
            ml: "auto",
            transform: open ? "rotate(180deg)" : "none",
            transition: "transform 150ms ease",
          }}
        >
          <ChevronDown size={16} />
        </Box>
      </ButtonBase>
      <Collapse in={open} id={panelId}>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <Box
            component="ul"
            sx={{ m: 0, pl: 2.25, display: "flex", flexDirection: "column", gap: 0.5 }}
          >
            <Typography component="li" variant="body2" sx={{ color: "text.secondary" }}>
              {/* Each "rating = age" pair stays on one line on narrow screens. */}
              <Trans
                i18nKey="profileManagement.fields.maturityLimitHowUsRatings"
                components={{ pair: <Box component="span" sx={{ whiteSpace: "nowrap" }} /> }}
              />
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: "text.secondary" }}>
              {t("profileManagement.fields.maturityLimitHowUnrated")}
            </Typography>
            <Typography component="li" variant="body2" sx={{ color: "text.secondary" }}>
              {t("profileManagement.fields.maturityLimitHowPin")}
            </Typography>
          </Box>
          <Typography
            variant="caption"
            sx={{
              display: "block",
              mt: 1,
              pt: 1,
              borderTop: `1px solid ${border.hairline}`,
              color: "text.secondary",
              fontWeight: 400,
            }}
          >
            {t("profileManagement.fields.maturityLimitCacheNote")}
          </Typography>
        </Box>
      </Collapse>
    </Box>
  );
}
