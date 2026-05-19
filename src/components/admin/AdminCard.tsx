import { Box, Stack, Typography } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AdminCardProps {
  children: ReactNode;
  padding?: number;
  sx?: object;
}

/**
 * Surface primitive used by every admin page. Hairline border on a
 * very-slightly-elevated background; consciously *not* the MUI
 * ``Card`` so we don't inherit the heavier border + radius set in
 * the theme (those belong to user-facing media cards).
 */
export function AdminCard({ children, padding = 22, sx }: AdminCardProps) {
  return (
    <Box
      sx={{
        bgcolor: "rgba(255,255,255,0.015)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 1,
        padding: `${padding}px`,
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

interface AdminCardHeaderProps {
  title: ReactNode;
  subtitle?: ReactNode;
  /** Optional lucide icon rendered to the left of the title with
   *  the standard muted-foreground tint + 16 px size. Centralizes
   *  the icon styling so every card surface picks up future tweaks
   *  for free. */
  icon?: LucideIcon;
  /** Optional inline node rendered right after the title (e.g.
   *  a status badge or count). Kept distinct from ``action`` so
   *  the trailing chip stays adjacent to the title text instead
   *  of pinning to the top-right of the card. */
  titleBadge?: ReactNode;
  action?: ReactNode;
}

/**
 * Header strip used inside ``AdminCard`` — title on the left, optional
 * subtitle below, optional right-aligned action slot (button, chip,
 * link). Always sits flush with the card padding so callers don't
 * have to add extra spacing.
 */
export function AdminCardHeader({
  title,
  subtitle,
  icon: Icon,
  titleBadge,
  action,
}: AdminCardHeaderProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 2,
        mb: 2,
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap">
          {Icon && (
            <Box sx={{ color: "text.secondary", display: "flex" }}>
              <Icon size={16} aria-hidden />
            </Box>
          )}
          <Typography
            variant="h3"
            component="span"
            sx={{ fontSize: "0.9375rem", fontWeight: 600 }}
          >
            {title}
          </Typography>
          {titleBadge}
        </Stack>
        {subtitle && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {action && <Box sx={{ flexShrink: 0 }}>{action}</Box>}
    </Box>
  );
}
