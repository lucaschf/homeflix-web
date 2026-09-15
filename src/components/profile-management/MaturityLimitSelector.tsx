import { useId, useState, type ReactNode } from "react";
import {
  Box,
  ButtonBase,
  Collapse,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
  Typography,
} from "@mui/material";
import type { Breakpoint } from "@mui/material/styles";
import { ChevronDown, Circle, CircleCheck, Globe, Info } from "lucide-react";
import { Trans, useTranslation } from "react-i18next";
import { border, whiteAlpha } from "../../theme/tokens";
import { ContentRatingBadge } from "../ContentRatingBadge";

/**
 * Age steps the selector offers besides "unrestricted" (ADR-035, D7):
 * ``0`` is "L" (all audiences), then the age ratings up to 16. The API
 * accepts any age from 0 to 21.
 */
const MATURITY_LIMIT_AGES = [0, 10, 12, 14, 16];

/** Radio value for "no limit"; the ages use their decimal string. */
const UNRESTRICTED = "unrestricted";

const limitToRadio = (limit: number | null) => (limit === null ? UNRESTRICTED : String(limit));
const radioToLimit = (value: string) => (value === UNRESTRICTED ? null : Number(value));

/**
 * The age a title without a rating requires: the backend resolves it to
 * ``AgeRating.ADULT``, so only a limit from 18 up reaches unrated titles.
 */
const UNRATED_AGE = 18;

/** The ClassInd scale the summary strip draws, with the age each rating requires. */
const CLASSIND_RATINGS = [
  { label: "L", age: 0 },
  { label: "10", age: 10 },
  { label: "12", age: 12 },
  { label: "14", age: 14 },
  { label: "16", age: 16 },
  { label: "18", age: 18 },
];

/** Description per offered step; any other stored age reads as a custom limit. */
const STEP_DESCRIPTION_KEYS: Record<number, string> = {
  0: "profileManagement.fields.maturityLimitAllAgesDescription",
  10: "profileManagement.fields.maturityLimitUpTo10Description",
  12: "profileManagement.fields.maturityLimitUpTo12Description",
  14: "profileManagement.fields.maturityLimitUpTo14Description",
  16: "profileManagement.fields.maturityLimitUpTo16Description",
};

const BADGE_SIZE = 28;
const SUMMARY_BADGE_SIZE = 22;

/** Kept in the accessibility tree, out of sight. */
const VISUALLY_HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  p: 0,
  m: "-1px",
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

/**
 * Whether a profile limited to ``limit`` sees a title requiring ``age``,
 * the same comparison the backend's ``AgeRating.allows`` makes.
 */
const allows = (limit: number | null, age: number) => limit === null || age <= limit;

/** Option grid columns: one count, or a count per breakpoint. */
type Columns = number | Partial<Record<Breakpoint, number>>;

const repeatColumns = (count: number) => `repeat(${count}, minmax(0, 1fr))`;

const gridTemplateColumns = (columns: Columns) =>
  typeof columns === "number"
    ? repeatColumns(columns)
    : Object.fromEntries(
        Object.entries(columns).map(([breakpoint, count]) => [breakpoint, repeatColumns(count)]),
      );

interface MaturityLimitSelectorProps {
  /** The selected limit: a minimum age, or ``null`` for unrestricted. */
  value: number | null;
  /**
   * The limit the profile has stored. An age outside the offered steps
   * (set through the API) is listed as an extra option, so it stays
   * visible and selectable after the operator picks another one.
   */
  storedLimit: number | null;
  onChange: (limit: number | null) => void;
  disabled?: boolean;
  /**
   * Columns of the option grid, as a count or a count per breakpoint
   * (``{ xs: 1, md: 2 }``). Cards fill it row by row in option order,
   * so arrow keys still walk the options in reading order.
   */
  columns?: Columns;
}

/**
 * Maturity limit picker for the profile form (ADR-035).
 *
 * A radio group rendered as option cards — rating badge, title and a
 * short description — followed by a strip of the ClassInd ratings the
 * selected limit lets through and a "how it works" note explaining how US
 * ratings map to ages, that unrated titles need an unrestricted profile,
 * that loosening the limit asks for the parental PIN, and that video the
 * server already cached is not covered. The note starts collapsed behind
 * a disclosure button so the choice itself stays compact.
 *
 * The component only reports the chosen limit through ``onChange``;
 * deciding whether that is a change worth writing stays with the form.
 */
export function MaturityLimitSelector({
  value,
  storedLimit,
  onChange,
  disabled = false,
  columns = 1,
}: MaturityLimitSelectorProps) {
  const { t } = useTranslation();
  const legendId = useId();
  const ages =
    storedLimit === null || MATURITY_LIMIT_AGES.includes(storedLimit)
      ? MATURITY_LIMIT_AGES
      : [...MATURITY_LIMIT_AGES, storedLimit].sort((a, b) => a - b);
  const selected = limitToRadio(value);

  return (
    <Box>
      <FormControl component="fieldset" disabled={disabled} sx={{ display: "flex" }}>
        <FormLabel
          id={legendId}
          component="legend"
          sx={{ typography: "body2", fontWeight: 600, mb: 1 }}
        >
          {t("profileManagement.fields.maturityLimit")}
        </FormLabel>
        <RadioGroup
          aria-labelledby={legendId}
          value={selected}
          onChange={(e) => onChange(radioToLimit(e.target.value))}
          sx={{ display: "grid", gridTemplateColumns: gridTemplateColumns(columns), gap: 0.75 }}
        >
          <OptionCard
            value={UNRESTRICTED}
            checked={selected === UNRESTRICTED}
            badge={
              <NeutralTile>
                <Globe size={16} />
              </NeutralTile>
            }
            title={t("profileManagement.fields.maturityLimitUnrestricted")}
            description={t("profileManagement.fields.maturityLimitUnrestrictedDescription")}
          />
          {ages.map((age) => {
            const descriptionKey = STEP_DESCRIPTION_KEYS[age];
            return (
              <OptionCard
                key={age}
                value={String(age)}
                checked={selected === String(age)}
                badge={
                  descriptionKey ? (
                    <ContentRatingBadge rating={age === 0 ? "L" : String(age)} size={BADGE_SIZE} />
                  ) : (
                    <NeutralTile>{age}</NeutralTile>
                  )
                }
                title={
                  age === 0
                    ? t("profileManagement.fields.maturityLimitAllAges")
                    : t("profileManagement.fields.maturityLimitUpTo", { age })
                }
                description={t(
                  descriptionKey ?? "profileManagement.fields.maturityLimitCustomDescription",
                )}
              />
            );
          })}
        </RadioGroup>
      </FormControl>
      <MaturitySummary limit={value} />
      <HowItWorks />
    </Box>
  );
}

interface OptionCardProps {
  value: string;
  checked: boolean;
  badge: ReactNode;
  title: string;
  description: string;
}

/**
 * One option: the whole card is the radio's label, and the radio itself
 * is the trailing check. The accessible name is the title alone and the
 * description is attached as such, so the badge text does not leak into
 * either.
 */
function OptionCard({ value, checked, badge, title, description }: OptionCardProps) {
  const id = useId();
  const titleId = `${id}-title`;
  const descriptionId = `${id}-description`;

  return (
    <FormControlLabel
      value={value}
      labelPlacement="start"
      control={
        <Radio
          disableRipple
          icon={<Circle size={20} />}
          checkedIcon={<CircleCheck size={20} />}
          slotProps={{
            input: { "aria-labelledby": titleId, "aria-describedby": descriptionId },
          }}
        />
      }
      label={
        <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <Box component="span" aria-hidden sx={{ display: "flex", flexShrink: 0 }}>
            {badge}
          </Box>
          <Box component="span" sx={{ minWidth: 0 }}>
            <Typography
              id={titleId}
              component="span"
              variant="body2"
              sx={{ display: "block", fontWeight: 600, color: "text.primary" }}
            >
              {title}
            </Typography>
            <Typography
              id={descriptionId}
              variant="caption"
              sx={{ display: "block", color: "text.secondary" }}
            >
              {description}
            </Typography>
          </Box>
        </Box>
      }
      sx={{
        m: 0,
        gap: 0.5,
        py: 1,
        pl: 1.25,
        pr: 0.75,
        borderRadius: 1.25,
        border: "1px solid",
        borderColor: checked ? "primary.main" : border.hairlineStrong,
        bgcolor: checked ? "primary.alpha8" : whiteAlpha(0.02),
        transition: "border-color 120ms ease, background-color 120ms ease",
        "&:hover": {
          borderColor: checked ? "primary.main" : whiteAlpha(0.24),
          bgcolor: checked ? "primary.alpha12" : whiteAlpha(0.04),
        },
        "&:has(.Mui-focusVisible)": {
          outline: (theme) => `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
        "&.Mui-disabled": { cursor: "default", opacity: 0.6 },
        "& .MuiFormControlLabel-label": { flex: 1, minWidth: 0 },
        "& .MuiRadio-root": { p: 0.25 },
      }}
    />
  );
}

/** Badge-sized tile for options without an official rating color. */
function NeutralTile({ children }: { children: ReactNode }) {
  return (
    <Box
      component="span"
      sx={{
        width: BADGE_SIZE,
        height: BADGE_SIZE,
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: whiteAlpha(0.08),
        border: `1px solid ${whiteAlpha(0.16)}`,
        color: "text.primary",
        fontWeight: 800,
        fontSize: BADGE_SIZE * 0.46,
        lineHeight: 1,
      }}
    >
      {children}
    </Box>
  );
}

/**
 * "This profile sees": the ClassInd ratings in full color when the limit
 * lets them through and dimmed otherwise, plus an "unrated" chip. The
 * drawing is hidden from assistive technology, which reads one sentence
 * listing what is seen and what is not.
 */
function MaturitySummary({ limit }: { limit: number | null }) {
  const { t } = useTranslation();
  const ratings = CLASSIND_RATINGS.map((rating) => ({
    ...rating,
    allowed: allows(limit, rating.age),
  }));
  const unratedAllowed = allows(limit, UNRATED_AGE);
  const allowed = ratings.filter((r) => r.allowed).map((r) => r.label).join(", ");
  const blocked = ratings.filter((r) => !r.allowed).map((r) => r.label).join(", ");
  // Unrated titles require 18, the top of the strip: when they are hidden,
  // so is at least the 18 badge, and when they are seen every badge is.
  const sentence = unratedAllowed
    ? t("profileManagement.fields.maturityLimitSummaryAll", { allowed })
    : t("profileManagement.fields.maturityLimitSummaryPartial", { allowed, blocked });

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        aria-hidden
        sx={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          columnGap: 1.25,
          rowGap: 0.75,
        }}
      >
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
          {t("profileManagement.fields.maturityLimitSummaryLabel")}
        </Typography>
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.5 }}>
          {ratings.map((rating) => (
            <Box
              key={rating.label}
              sx={{
                display: "flex",
                borderRadius: "4px",
                // A hairline ring keeps the shape readable where the badge
                // color is close to the surface (18) or faded out.
                boxShadow: `0 0 0 1px ${whiteAlpha(0.14)}`,
                "& > *": {
                  opacity: rating.allowed ? 1 : 0.3,
                  filter: rating.allowed ? "none" : "grayscale(1)",
                  transition: "opacity 120ms ease",
                },
              }}
            >
              <ContentRatingBadge rating={rating.label} size={SUMMARY_BADGE_SIZE} />
            </Box>
          ))}
          <Box
            component="span"
            sx={{
              ml: 0.5,
              px: 0.75,
              height: SUMMARY_BADGE_SIZE,
              display: "inline-flex",
              alignItems: "center",
              borderRadius: "4px",
              border: "1px solid",
              borderColor: unratedAllowed ? whiteAlpha(0.24) : border.hairlineStrong,
              typography: "caption",
              whiteSpace: "nowrap",
              color: unratedAllowed ? "text.primary" : "text.secondary",
              opacity: unratedAllowed ? 1 : 0.6,
              textDecoration: unratedAllowed ? "none" : "line-through",
            }}
          >
            {t("profileManagement.fields.maturityLimitUnrated")}
          </Box>
        </Box>
      </Box>
      <Box component="span" sx={VISUALLY_HIDDEN}>
        {sentence}
      </Box>
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
