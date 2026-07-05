import { Box, ToggleButton, ToggleButtonGroup, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { fontSize, peachAlpha, whiteAlpha } from "../../theme/tokens";

export interface SegmentedOption<V extends string> {
  value: V;
  label: ReactNode;
  /** Optional leading glyph (typically a 13px lucide icon). */
  icon?: ReactNode;
  /** Native title/tooltip describing the option. */
  title?: string;
}

interface SegmentedControlProps<V extends string> {
  value: V;
  options: SegmentedOption<V>[];
  onChange: (next: V) => void;
  /** Optional mono eyebrow rendered to the left of the group. */
  label?: ReactNode;
  ariaLabel?: string;
}

/**
 * Peach-accented segmented control built on MUI's
 * ``ToggleButtonGroup`` — the faithful primitive for a small,
 * mutually-exclusive choice (VISTA / DENSIDADE on the runtime
 * settings page). The active segment carries the peach tint the
 * design uses for selected state; the group sits on the same dark
 * ``#0D0D0D`` field surface as the rest of the admin controls.
 *
 * Enforces a non-null selection (clicking the active segment is a
 * no-op) so the caller always has a defined ``value``.
 */
export function SegmentedControl<V extends string>({
  value,
  options,
  onChange,
  label,
  ariaLabel,
}: SegmentedControlProps<V>) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        alignItems: { xs: "stretch", sm: "center" },
        gap: { xs: 0.75, sm: 1.25 },
        minWidth: 0,
      }}
    >
      {label && (
        <Typography
          variant="eyebrow"
          sx={{
            color: "text.secondary",
            letterSpacing: "0.1em",
            fontSize: fontSize.micro,
            flexShrink: 0,
          }}
        >
          {label}
        </Typography>
      )}
      <ToggleButtonGroup
        exclusive
        value={value}
        size="small"
        aria-label={ariaLabel}
        onChange={(_e, next: V | null) => {
          if (next !== null) onChange(next);
        }}
        sx={{
          // Full-width equal-share segments on phones so the control
          // reads as one clean bar instead of overflowing / wrapping
          // into tall stacked buttons; content-width from ``sm`` up.
          width: { xs: "100%", sm: "auto" },
          bgcolor: "#0D0D0D",
          border: `1px solid ${whiteAlpha(0.08)}`,
          borderRadius: 1,
          p: "3px",
          gap: "2px",
          "& .MuiToggleButtonGroup-grouped": {
            m: 0,
            border: 0,
            borderRadius: 0.75,
            flex: { xs: 1, sm: "0 0 auto" },
            px: 1.5,
            py: 0.75,
            gap: 0.875,
            whiteSpace: "nowrap",
            fontSize: fontSize.control,
            fontWeight: 500,
            lineHeight: 1.2,
            textTransform: "none",
            color: whiteAlpha(0.5),
            "&:hover": { bgcolor: whiteAlpha(0.04) },
            "&.Mui-selected": {
              color: "primary.main",
              fontWeight: 600,
              bgcolor: peachAlpha(0.16),
              "&:hover": { bgcolor: peachAlpha(0.22) },
            },
          },
        }}
      >
        {options.map((o) => (
          <ToggleButton key={o.value} value={o.value} title={o.title} aria-label={o.title}>
            {o.icon}
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}
