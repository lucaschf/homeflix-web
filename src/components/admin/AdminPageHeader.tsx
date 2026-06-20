import { Box, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { Fragment, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";
import { inkAlpha } from "../../theme/tokens";
import { HypothesisChip } from "./HypothesisChip";

/**
 * One breadcrumb segment. A plain string renders as static text (group
 * labels, the current page); ``{ label, to }`` renders as a navigable
 * link to a parent route.
 */
export type BreadcrumbSegment = ReactNode | { label: ReactNode; to: string };

interface AdminPageHeaderProps {
  breadcrumb?: BreadcrumbSegment[];
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
  // the component injects the root + chevrons. The root links back
  // to the overview.
  const fullBreadcrumb: BreadcrumbSegment[] | undefined =
    breadcrumb && breadcrumb.length > 0
      ? [{ label: t("admin.title"), to: "/admin" }, ...breadcrumb]
      : undefined;

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
          {fullBreadcrumb.map((segment, i) => {
            const isLast = i === fullBreadcrumb.length - 1;
            const linkable =
              segment != null &&
              typeof segment === "object" &&
              "to" in segment &&
              "label" in segment;
            const label = linkable ? segment.label : segment;
            // The current page (last crumb) is never a link, even when a
            // target is supplied.
            if (linkable && !isLast) {
              return (
                <Fragment key={i}>
                  {i > 0 && <ChevronRight size={14} aria-hidden />}
                  <Box
                    component={RouterLink}
                    to={segment.to}
                    sx={{
                      color: "inherit",
                      textDecoration: "none",
                      transition: "color 120ms ease",
                      "&:hover": { color: inkAlpha(0.85) },
                    }}
                  >
                    {label}
                  </Box>
                </Fragment>
              );
            }
            return (
              <Fragment key={i}>
                {i > 0 && <ChevronRight size={14} aria-hidden />}
                <Box
                  component="span"
                  sx={{ color: isLast ? inkAlpha(0.7) : "inherit" }}
                >
                  {label}
                </Box>
              </Fragment>
            );
          })}
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
