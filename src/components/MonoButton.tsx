import { ButtonBase, type ButtonBaseProps } from "@mui/material";

/**
 * Low-emphasis ghost button in the mono-caps "eyebrow" idiom — transparent
 * surface, uppercase label, wide letter-spacing, muted until hover. Used for
 * secondary actions like logout or the password show/hide toggle.
 *
 * Built on ``ButtonBase`` so keyboard, focus-visible and disabled semantics
 * come for free; the ripple is disabled because it reads as noise on a plain
 * text label. Override sizing or weight through ``sx`` and forward any native
 * button / aria props (``onClick``, ``disabled``, ``aria-pressed``, …).
 */
export function MonoButton({ sx, ...props }: ButtonBaseProps) {
  return (
    <ButtonBase
      type="button"
      disableRipple
      sx={{
        fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
        fontSize: 11,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: "text.secondary",
        transition: "color 160ms ease",
        "&:hover": { color: "text.primary" },
        "&.Mui-disabled": { opacity: 0.5 },
        ...sx,
      }}
      {...props}
    />
  );
}
