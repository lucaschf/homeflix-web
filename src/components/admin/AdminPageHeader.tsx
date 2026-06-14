import { Box, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { inkAlpha } from "../../theme/tokens";
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
  const { t } = useTranslation();

  // Always prepend "Admin" as the breadcrumb root so every admin
  // page anchors at the same starting point. Consumers pass only
  // the segments below "Admin" (e.g. ``[Catalog, Movies]``) and
  // the component injects the root + chevrons.
  const fullBreadcrumb: ReactNode[] | undefined =
    breadcrumb && breadcrumb.length > 0 ? [t("admin.title"), ...breadcrumb] : undefined;

  return (
    <Box component="header" sx={{ mb: 3.5 }}>
      {fullBreadcrumb && (
        <Typography
          variant="breadcrumb"
          color="text.secondary"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 1.5,
          }}
        >
          {fullBreadcrumb.map((segment, i) => (
            <Fragment key={i}>
              {i > 0 && <ChevronRight size={14} aria-hidden />}
              <Box
                component="span"
                sx={{
                  color:
                    i === fullBreadcrumb.length - 1
                      ? inkAlpha(0.7)
                      : "inherit",
                }}
              >
                {segment}
              </Box>
            </Fragment>
          ))}
        </Typography>
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
              variant="pageTitle"
              sx={{ m: 0, color: "text.primary" }}
            >
              {title}
            </Typography>
            {hypothesis && <HypothesisChip>{hypothesis}</HypothesisChip>}
          </Box>
          {subtitle && (
            <Typography
              variant="pageSubtitle"
              sx={{
                mt: 1,
                color: inkAlpha(0.55),
                maxWidth: 720,
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
