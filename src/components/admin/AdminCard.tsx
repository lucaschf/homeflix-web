import { Box, Typography } from "@mui/material";
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
  action?: ReactNode;
}

/**
 * Header strip used inside ``AdminCard`` — title on the left, optional
 * subtitle below, optional right-aligned action slot (button, chip,
 * link). Always sits flush with the card padding so callers don't
 * have to add extra spacing.
 */
export function AdminCardHeader({ title, subtitle, action }: AdminCardHeaderProps) {
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
        <Typography variant="h3" sx={{ fontSize: "0.9375rem", fontWeight: 600 }}>
          {title}
        </Typography>
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
