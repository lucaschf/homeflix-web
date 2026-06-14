import type { ReactNode } from "react";
import { Button } from "@mui/material";
import { peachAlpha, panelScrim } from "../../theme/tokens";

interface PrimaryButtonProps {
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  fullWidth?: boolean;
  size?: "md" | "lg";
  disabled?: boolean;
}

/**
 * Peach primary button per Variação B. Wraps MUI's ``Button`` so
 * ``type="submit"``, focus-visible outlines and ripple stay
 * idiomatic, while the ``sx`` overrides match the spec's hover
 * (peach.light) and translateY(-1px) lift exactly.
 *
 * Two sizes mirror the handoff: ``md`` for forms inside compact
 * surfaces, ``lg`` for the wide login button on bigger viewports.
 */
export function PrimaryButton({
  children,
  onClick,
  type = "button",
  fullWidth = true,
  size = "md",
  disabled = false,
}: PrimaryButtonProps) {
  const isLg = size === "lg";
  return (
    <Button
      onClick={onClick}
      type={type}
      fullWidth={fullWidth}
      disabled={disabled}
      disableElevation
      disableRipple={false}
      sx={{
        bgcolor: "primary.main",
        color: "primary.contrastText",
        textTransform: "none",
        fontWeight: 600,
        fontSize: isLg ? 15 : 14,
        letterSpacing: "-0.005em",
        py: isLg ? "16px" : "12px",
        px: isLg ? "24px" : "22px",
        transition: "background-color 160ms ease, transform 160ms ease",
        "&:hover": {
          bgcolor: "primary.light",
          transform: "translateY(-1px)",
        },
        "&:disabled": {
          bgcolor: peachAlpha(0.4),
          color: panelScrim(0.6),
        },
      }}
    >
      {children}
    </Button>
  );
}
