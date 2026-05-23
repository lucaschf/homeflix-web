import { Box, Tooltip, Typography } from "@mui/material";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Film,
  HardDrive,
  Heart,
  Inbox,
  Library,
  type LucideIcon,
  Music,
  ScanLine,
  SlidersHorizontal,
  Sparkles,
  Tv,
  Users,
} from "lucide-react";
import { Link as RouterLink, useLocation, useMatch } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useMoviesNeedingReview } from "../../api/hooks";
import { Logo } from "../Logo";

interface SidebarItem {
  /** i18n key for the label. */
  labelKey: string;
  /** Route the item navigates to. */
  to: string;
  icon: LucideIcon;
  /** When true, ``useMatch`` is used so subroutes (e.g.
   *  ``/admin/intros/:seriesId/:season/:episode``) still highlight
   *  the parent. Otherwise we use exact-equality on the pathname. */
  matchPrefix?: boolean;
  /** Optional badge slot — wired to a number from a hook. ``undefined``
   *  renders no badge; ``0`` also renders no badge (cleaner UI). */
  badgeCount?: number;
}

interface SidebarGroup {
  /** ``null`` for the implicit first group (Overview). */
  labelKey: string | null;
  items: SidebarItem[];
}

interface AdminSidebarProps {
  collapsed: boolean;
}

/**
 * Three-group navigation rail. Highlights the active route with a
 * peach accent bar + tinted background; collapses to icon-only on
 * lg breakpoint and below. Group labels turn into 1-px dividers in
 * the collapsed state so the visual rhythm survives without the
 * eyebrows.
 */
export function AdminSidebar({ collapsed }: AdminSidebarProps) {
  const { t } = useTranslation();

  const reviewQueue = useMoviesNeedingReview();
  const reviewBadge = reviewQueue.data?.length ?? 0;

  const groups: SidebarGroup[] = [
    {
      labelKey: null,
      items: [
        {
          labelKey: "admin.nav.overview",
          to: "/admin",
          icon: Activity,
        },
      ],
    },
    {
      labelKey: "admin.nav.group.catalog",
      items: [
        { labelKey: "admin.nav.libraries", to: "/admin/libraries", icon: Library, matchPrefix: true },
        { labelKey: "admin.nav.movies", to: "/admin/catalog/movies", icon: Film },
        { labelKey: "admin.nav.series", to: "/admin/catalog/series", icon: Tv },
        {
          labelKey: "admin.nav.review",
          to: "/admin/catalog/review",
          icon: AlertTriangle,
          badgeCount: reviewBadge,
        },
        { labelKey: "admin.nav.scan", to: "/admin/scan", icon: ScanLine },
        { labelKey: "admin.nav.enrich", to: "/admin/enrich", icon: Sparkles },
        {
          labelKey: "admin.nav.intros",
          to: "/admin/intros",
          icon: Music,
          matchPrefix: true,
        },
        { labelKey: "admin.nav.requests", to: "/admin/requests", icon: Inbox },
      ],
    },
    {
      labelKey: "admin.nav.group.identity",
      items: [
        { labelKey: "admin.nav.users", to: "/admin/users", icon: Users, matchPrefix: true },
      ],
    },
    {
      labelKey: "admin.nav.group.system",
      items: [
        { labelKey: "admin.nav.hls", to: "/admin/system/hls-cache", icon: HardDrive },
        { labelKey: "admin.nav.health", to: "/admin/system/health", icon: Heart },
        {
          labelKey: "admin.nav.settings",
          to: "/admin/system/settings",
          icon: SlidersHorizontal,
        },
      ],
    },
  ];

  return (
    <Box
      component="aside"
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "#0d0d0d",
        borderRight: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <BrandRow collapsed={collapsed} />

      <Box
        component="nav"
        sx={{ flex: 1, overflowY: "auto", py: 1.5 }}
        aria-label="Admin navigation"
      >
        {groups.map((group, gi) => (
          <Box key={gi} sx={{ mb: 1.75 }}>
            {!collapsed && group.labelKey && (
              <Typography
                variant="eyebrow"
                sx={{
                  display: "block",
                  color: "text.secondary",
                  fontSize: "0.6875rem",
                  pt: 1.5,
                  pb: 1,
                  pl: 4,
                  letterSpacing: "0.18em",
                }}
              >
                {t(group.labelKey)}
              </Typography>
            )}
            {collapsed && group.labelKey && (
              <Box
                sx={{
                  height: "1px",
                  mx: 2,
                  my: 1,
                  bgcolor: "rgba(255,255,255,0.08)",
                }}
              />
            )}
            {group.items.map((item) => (
              <SidebarRow key={item.to} item={item} collapsed={collapsed} />
            ))}
          </Box>
        ))}
      </Box>

      <BackToAppRow collapsed={collapsed} />
    </Box>
  );
}

function BrandRow({ collapsed }: { collapsed: boolean }) {
  return (
    <Box
      component={RouterLink}
      to="/admin"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 4,
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        textDecoration: "none",
        color: "text.primary",
        height: 86,
        flexShrink: 0,
      }}
    >
      <Box sx={{ display: "flex", flexShrink: 0, color: "primary.main" }}>
        <Logo size={34} />
      </Box>
      {!collapsed && (
        <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
          <Box
            component="span"
            sx={{
              fontWeight: 600,
              fontSize: "0.9375rem",
              color: "text.primary",
              letterSpacing: "-0.01em",
            }}
          >
            HomeFlix
          </Box>
          <Box
            component="span"
            sx={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: "0.625rem",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "text.secondary",
            }}
          >
            Admin
          </Box>
        </Box>
      )}
    </Box>
  );
}

function SidebarRow({ item, collapsed }: { item: SidebarItem; collapsed: boolean }) {
  const { t } = useTranslation();
  const location = useLocation();
  const exactMatch = location.pathname === item.to;
  const prefixMatch = useMatch({ path: `${item.to}/*`, end: false });
  const isActive = item.matchPrefix ? Boolean(prefixMatch) || exactMatch : exactMatch;
  const Icon = item.icon;
  const label = t(item.labelKey);
  const hasBadge = item.badgeCount && item.badgeCount > 0;

  const content = (
    <Box
      component={RouterLink}
      to={item.to}
      aria-current={isActive ? "page" : undefined}
      sx={{
        position: "relative",
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 1.75,
        py: 1.5,
        px: collapsed ? 0 : 4,
        justifyContent: collapsed ? "center" : "flex-start",
        bgcolor: isActive ? "rgba(217,119,87,0.07)" : "transparent",
        color: isActive ? "text.primary" : "rgba(245,241,235,0.7)",
        fontSize: "0.9375rem",
        fontWeight: isActive ? 500 : 400,
        textDecoration: "none",
        cursor: "pointer",
        transition: "background-color 120ms ease, color 120ms ease",
        "&:hover": isActive
          ? {}
          : { bgcolor: "rgba(255,255,255,0.03)", color: "text.primary" },
      }}
    >
      {isActive && (
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            left: 0,
            top: 8,
            bottom: 8,
            width: 3,
            bgcolor: "primary.main",
            borderRadius: "0 2px 2px 0",
          }}
        />
      )}
      <Icon
        size={24}
        color={isActive ? "#D97757" : "currentColor"}
        aria-hidden
      />
      {!collapsed && <Box sx={{ flex: 1 }}>{label}</Box>}
      {!collapsed && hasBadge && (
        <Box
          component="span"
          sx={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "0.6875rem",
            fontWeight: 600,
            py: 0.375,
            px: 1,
            borderRadius: 0.5,
            bgcolor: "rgba(217,119,87,0.15)",
            color: "primary.main",
          }}
        >
          {item.badgeCount}
        </Box>
      )}
    </Box>
  );

  if (collapsed) {
    return (
      <Tooltip title={label} placement="right" arrow>
        <Box>{content}</Box>
      </Tooltip>
    );
  }
  return content;
}

function BackToAppRow({ collapsed }: { collapsed: boolean }) {
  const { t } = useTranslation();
  return (
    <Box
      component={RouterLink}
      to="/"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: collapsed ? "center" : "flex-start",
        gap: 1.75,
        py: 2,
        px: collapsed ? 0 : 4,
        borderTop: "1px solid rgba(255,255,255,0.08)",
        color: "text.secondary",
        textDecoration: "none",
        fontSize: "0.875rem",
        flexShrink: 0,
        "&:hover": { color: "text.primary", bgcolor: "rgba(255,255,255,0.03)" },
      }}
    >
      <ArrowLeft size={21} aria-hidden />
      {!collapsed && <Box>{t("admin.nav.backToApp")}</Box>}
    </Box>
  );
}
