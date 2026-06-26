import { Button, type ButtonProps } from "@mui/material";
import type { ReactNode } from "react";

type AdminButtonVariant = "primary" | "secondary" | "ghost" | "danger";

// Map the admin-facing names onto the canonical Button variants registered in
// the theme (ADR-001). The look (coral CTA, hairline secondary, ghost, danger),
// the control type scale, padding and the single 8px radius all live in the
// theme now — this wrapper only translates the variant name and forwards the
// optional leading icon, so admin buttons stay a one-liner at the call-site.
const VARIANT_MAP = {
  primary: "cta",
  secondary: "hairline",
  ghost: "ghost",
  danger: "danger",
} as const;

interface AdminButtonProps extends Omit<ButtonProps, "variant" | "color"> {
  variant?: AdminButtonVariant;
  icon?: ReactNode;
}

/**
 * Theme-aware wrapper around MUI's ``Button`` exposing the four admin variants
 * (``primary`` coral CTA, ``secondary`` hairline, ``ghost`` transparent,
 * ``danger`` red-tinted). All styling is centralized in the theme's canonical
 * Button variants (ADR-001); this is a thin name-mapping shim kept for the
 * existing ``primary | secondary | ghost | danger`` call-site vocabulary.
 */
export function AdminButton({
  variant = "secondary",
  icon,
  children,
  ...rest
}: AdminButtonProps) {
  return (
    <Button {...rest} variant={VARIANT_MAP[variant]} startIcon={icon}>
      {children}
    </Button>
  );
}
