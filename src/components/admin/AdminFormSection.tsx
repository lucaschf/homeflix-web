import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface AdminFormSectionProps {
  title: ReactNode;
  helper?: ReactNode;
  children: ReactNode;
}

/**
 * Form row primitive used by Library/User/Profile detail pages:
 * a label column on the left (300 px, eyebrow style) and the field
 * column on the right. Collapses to a stacked layout below md so
 * the field never gets squeezed.
 *
 * The helper text sits beneath the label rather than below the
 * field — keeps it visible at a glance even when the field is a
 * tall composite (array editor, drag-list, etc.). The 300 px left
 * column was widened from the original 240 px because helper
 * paragraphs (two short sentences) were wrapping aggressively in
 * pt-BR — the extra 60 px collapses ~2 lines of vertical reflow
 * without crowding the field column.
 */
export function AdminFormSection({ title, helper, children }: AdminFormSectionProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "300px 1fr" },
        columnGap: 4,
        rowGap: 1.5,
        py: 3,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        "&:first-of-type": { borderTop: "none", pt: 1 },
      }}
    >
      <Box>
        <Typography
          variant="eyebrow"
          sx={{
            display: "block",
            color: "text.primary",
            letterSpacing: "0.14em",
            fontSize: "0.6875rem",
          }}
        >
          {title}
        </Typography>
        {helper && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.75, lineHeight: 1.5 }}
          >
            {helper}
          </Typography>
        )}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}
