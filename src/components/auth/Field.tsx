import { useId, useState, type ChangeEvent, type ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { fontSize, inkAlpha, peachAlpha, whiteAlpha } from "../../theme/tokens";

interface FieldProps {
  label: string;
  type?: string;
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  autoFocus?: boolean;
  placeholder?: string;
  /** Optional element rendered inside the field on the right edge — used for the password show/hide toggle. */
  rightSlot?: ReactNode;
  /** Auto-completion hint forwarded to the underlying ``<input>``. */
  autoComplete?: string;
  /** Required for password managers and a11y (cannot share names across fields). */
  name?: string;
  /** Disables the input while a mutation is in flight. */
  disabled?: boolean;
}

/**
 * Labeled text input matching the Variação B handoff: mono caps
 * eyebrow that turns peach on focus, a hairline-bordered surface
 * with a soft peach glow on focus, and an optional right slot for
 * the show/hide toggle.
 *
 * Built fresh rather than restyling MUI's ``TextField`` because the
 * focus-aware label colour and the rightSlot composition would
 * require fighting MUI's internal layout. The native ``<input>``
 * underneath keeps form submission and password-manager autofill
 * working unchanged.
 */
export function Field({
  label,
  type = "text",
  value,
  onChange,
  autoFocus,
  placeholder,
  rightSlot,
  autoComplete,
  name,
  disabled = false,
}: FieldProps) {
  const [focused, setFocused] = useState(false);
  const id = useId();

  const borderColor = focused ? peachAlpha(0.5) : whiteAlpha(0.08);

  return (
    <Box component="label" htmlFor={id} sx={{ display: "block" }}>
      <Typography
        variant="eyebrow"
        sx={{
          color: focused ? "primary.main" : "text.secondary",
          mb: 1,
          transition: "color 160ms ease",
          display: "block",
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          bgcolor: whiteAlpha(0.03),
          border: `1px solid ${borderColor}`,
          borderRadius: 2,
          px: 2,
          py: 1.25,
          transition: "border-color 160ms ease, box-shadow 160ms ease",
          boxShadow: focused ? `0 0 0 3px ${peachAlpha(0.08)}` : "none",
        }}
      >
        <Box
          component="input"
          id={id}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus={autoFocus}
          placeholder={placeholder}
          autoComplete={autoComplete}
          disabled={disabled}
          sx={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "text.primary",
            fontFamily: "inherit",
            fontSize: fontSize.control,
            letterSpacing: "-0.005em",
            "&::placeholder": { color: inkAlpha(0.3) },
            "&:disabled": { cursor: "not-allowed", opacity: 0.6 },
          }}
        />
        {rightSlot}
      </Box>
    </Box>
  );
}
