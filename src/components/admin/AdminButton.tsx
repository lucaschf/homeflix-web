import { Button, type ButtonProps } from "@mui/material";
import type { ReactNode } from "react";

type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface AdminButtonProps extends Omit<ButtonProps, "variant" | "color"> {
  variant?: AdminButtonVariant;
  icon?: ReactNode;
}

/**
 * Theme-aware wrapper around MUI's ``Button`` that exposes the four
 * variants the admin design uses (``primary`` peach CTA, ``secondary``
 * outlined hairline, ``ghost`` transparent, ``danger`` red-tinted).
 *
 * MUI's ``contained`` / ``outlined`` / ``text`` map almost cleanly,
 * but the admin look needs subtle tweaks (hairline border on
 * secondary, red tint on danger) so we centralise them here instead
 * of repeating ``sx`` overrides on every call site.
 */
export function AdminButton({
  variant = "secondary",
  icon,
  children,
  sx,
  ...rest
}: AdminButtonProps) {
  const variantStyles = (() => {
    if (variant === "primary") {
      return {
        bgcolor: "primary.main",
        color: "primary.contrastText",
        border: 1,
        borderColor: "primary.main",
        fontWeight: 600,
        "&:hover": { bgcolor: "primary.dark", borderColor: "primary.dark" },
      } as const;
    }
    if (variant === "ghost") {
      return {
        bgcolor: "transparent",
        color: "text.secondary",
        border: 1,
        borderColor: "transparent",
        "&:hover": { bgcolor: "rgba(255,255,255,0.04)", color: "text.primary" },
      } as const;
    }
    if (variant === "danger") {
      return {
        bgcolor: "rgba(220,80,70,0.08)",
        color: "#ff8a7a",
        border: 1,
        borderColor: "rgba(220,80,70,0.35)",
        "&:hover": { bgcolor: "rgba(220,80,70,0.14)" },
      } as const;
    }
    // secondary
    return {
      bgcolor: "rgba(255,255,255,0.04)",
      color: "text.primary",
      border: 1,
      borderColor: "rgba(255,255,255,0.08)",
      "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
    } as const;
  })();

  return (
    <Button
      {...rest}
      disableElevation
      startIcon={icon}
      sx={{
        textTransform: "none",
        fontWeight: 500,
        fontSize: "0.8125rem",
        py: 0.875,
        px: 1.75,
        borderRadius: 0.625,
        transition: "background-color 140ms ease, border-color 140ms ease",
        ...variantStyles,
        ...sx,
      }}
    >
      {children}
    </Button>
  );
}
