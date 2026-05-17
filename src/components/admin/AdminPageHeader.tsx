import { Box, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { HypothesisChip } from "./HypothesisChip";

interface AdminPageHeaderProps {
  breadcrumb?: ReactNode[];
  title: ReactNode;
  subtitle?: ReactNode;
  /** Surfaces a peach "Hipótese · …" chip next to the title for
   *  decisions still pending in the backend / spec. */
  hypothesis?: ReactNode;
  /** Right-aligned primary action slot (typically a single
   *  ``AdminButton variant="primary"``). */
  primaryCTA?: ReactNode;
  /** Optional toolbar row rendered below the title row. Use
   *  ``AdminToolbar`` for the layout. */
  toolbar?: ReactNode;
}

/**
 * Standard page chrome at the top of every admin route. Renders an
 * uppercase mono breadcrumb, the page title (Space Grotesk, 28 px),
 * a muted subtitle, an optional CTA slot on the right, and an
 * optional toolbar row.
 */
export function AdminPageHeader({
  breadcrumb,
  title,
  subtitle,
  hypothesis,
  primaryCTA,
  toolbar,
}: AdminPageHeaderProps) {
  return (
    <Box component="header" sx={{ mb: 3.5 }}>
      {breadcrumb && breadcrumb.length > 0 && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 1.5,
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "0.65625rem",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "text.secondary",
          }}
        >
          {breadcrumb.map((segment, i) => (
            <Fragment key={i}>
              {i > 0 && <ChevronRight size={11} aria-hidden />}
              <Box
                component="span"
                sx={{
                  color:
                    i === breadcrumb.length - 1
                      ? "rgba(245,241,235,0.7)"
                      : "inherit",
                }}
              >
                {segment}
              </Box>
            </Fragment>
          ))}
        </Box>
      )}
      <Box
        sx={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 3,
          flexWrap: "wrap",
        }}
      >
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "baseline",
              gap: 1.75,
              flexWrap: "wrap",
            }}
          >
            <Typography
              variant="h1"
              component="h1"
              sx={{
                m: 0,
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                fontSize: "1.75rem",
                fontWeight: 600,
                letterSpacing: "-0.02em",
                lineHeight: 1.1,
                color: "text.primary",
              }}
            >
              {title}
            </Typography>
            {hypothesis && <HypothesisChip>{hypothesis}</HypothesisChip>}
          </Box>
          {subtitle && (
            <Typography
              variant="body2"
              sx={{
                mt: 1,
                fontSize: "0.84375rem",
                color: "rgba(245,241,235,0.55)",
                maxWidth: 720,
                lineHeight: 1.55,
              }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {primaryCTA && <Box sx={{ flexShrink: 0 }}>{primaryCTA}</Box>}
      </Box>
      {toolbar && <Box sx={{ mt: 3 }}>{toolbar}</Box>}
    </Box>
  );
}
