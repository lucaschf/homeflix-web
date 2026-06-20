import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { whiteAlpha } from "../../theme/tokens";

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
 * tall composite (array editor, drag-list, etc.). The left column
 * grew from the original 240 px → 300 px → the responsive track
 * below because helper paragraphs (two short sentences) kept
 * wrapping aggressively in pt-BR, stacking the rows tall while a
 * wide empty gutter sat to the right of the (capped-width) fields.
 * Letting the label column scale up to 460 px on large screens
 * soaks up that gutter and collapses the helper text to ~2 lines.
 */
export function AdminFormSection({ title, helper, children }: AdminFormSectionProps) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          md: "340px 1fr",
          lg: "minmax(380px, 460px) 1fr",
        },
        columnGap: 4,
        rowGap: 1.5,
        py: 3,
        borderTop: `1px solid ${whiteAlpha(0.06)}`,
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
