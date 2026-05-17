import { Box, Typography } from "@mui/material";
import { Inbox, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface AdminEmptyStateProps {
  icon?: LucideIcon;
  title: ReactNode;
  body?: ReactNode;
  cta?: ReactNode;
}

/**
 * Centered "nothing here yet" affordance. Used inside tables, page
 * bodies, and detail-row lists.
 *
 * Default icon is ``Inbox`` because most empty admin states are
 * queue-like (no flagged movies, no catalog requests, no scan
 * runs); callers swap to a more specific icon when the surface
 * has its own metaphor (e.g. ``Library`` on /admin/libraries).
 */
export function AdminEmptyState({
  icon: Icon = Inbox,
  title,
  body,
  cta,
}: AdminEmptyStateProps) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        py: 8,
        px: 3,
        border: "1px dashed rgba(255,255,255,0.10)",
        borderRadius: 1,
        bgcolor: "rgba(255,255,255,0.015)",
      }}
    >
      <Box
        sx={{
          width: 52,
          height: 52,
          borderRadius: 1,
          bgcolor: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 2,
          color: "text.secondary",
        }}
      >
        <Icon size={22} aria-hidden />
      </Box>
      <Typography variant="body1" sx={{ fontWeight: 600, mb: body ? 0.75 : 0 }}>
        {title}
      </Typography>
      {body && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
          {body}
        </Typography>
      )}
      {cta && <Box sx={{ mt: 2.5 }}>{cta}</Box>}
    </Box>
  );
}
