import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  IconButton,
  Paper,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Bookmark, Film, Home, Search, Tv, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCurrentUser } from "../api/auth";
import { AccountMenu } from "./AccountMenu";
import { Logo } from "./Logo";
import { SearchOverlay } from "./SearchOverlay";

interface NavItem {
  to: string;
  labelKey: string;
  icon: typeof Home;
  desktopOnly?: boolean;
  mobileOnly?: boolean;
  /**
   * When set, the item is only rendered for users carrying the
   * matching role. Used to keep the wrench / admin entry out of a
   * household member's navbar — the underlying ``/admin/*`` routes
   * are gated by ``<RequireAdmin />`` independently, so a member
   * who reaches them by URL still gets bounced back to "/".
   */
  requiresRole?: "admin";
}

const navItems: NavItem[] = [
  { to: "/", labelKey: "nav.home", icon: Home },
  { to: "/browse?type=movie", labelKey: "nav.movies", icon: Film },
  { to: "/browse?type=series", labelKey: "nav.series", icon: Tv },
  {
    to: "/admin",
    labelKey: "nav.admin",
    icon: Wrench,
    desktopOnly: true,
    requiresRole: "admin",
  },
  { to: "/lists", labelKey: "nav.myListsShort", icon: Bookmark, mobileOnly: true },
];

export function Navbar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchOpen, setSearchOpen] = useState(false);
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin";

  // Drop role-gated items the current user does not qualify for.
  // Computed every render off ``isAdmin`` so a logout / switch
  // immediately re-evaluates without a page reload.
  const visibleItems = useMemo(
    () => navItems.filter((item) => !item.requiresRole || isAdmin),
    [isAdmin],
  );
  const desktopNavItems = visibleItems.filter((item) => !item.mobileOnly);
  const bottomNavItems = visibleItems.filter((item) => !item.desktopOnly);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      setSearchOpen(true);
    }
  }, []);

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Inline so it picks up the role-filtered ``bottomNavItems`` —
  // module-scope wouldn't see the admin-gated items dropping out.
  const activeBottomNav = bottomNavItems.findIndex((item) => {
    if (!item.to.includes("?")) return item.to === location.pathname;
    return item.to === `${location.pathname}?${location.search.replace(/^\?/, "")}`;
  });

  return (
    <>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(13, 13, 13, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {/* Logo */}
          <Box
            component={NavLink}
            to="/"
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              textDecoration: "none",
              color: "text.primary",
              mr: { xs: 1, md: 4 },
            }}
          >
            <Logo size={isMobile ? 24 : 30} />
            {!isMobile && (
              <Typography variant="h3" noWrap>
                Home<Box component="span" sx={{ color: "primary.main" }}>Flix</Box>
              </Typography>
            )}
          </Box>

          {/* Desktop Nav Links — hidden on mobile */}
          {!isMobile && (
            <Box sx={{ display: "flex", gap: 0.5, flexGrow: 1 }}>
              {desktopNavItems.map(({ to, labelKey }) => {
                const [path, query] = to.split("?");
                const params = new URLSearchParams(query);
                const searchParams = new URLSearchParams(location.search);
                const isActive = query
                  ? location.pathname === path &&
                    searchParams.get("type") === params.get("type")
                  : location.pathname === path;
                return (
                  <Button
                    key={to}
                    component={NavLink}
                    to={to}
                    size="small"
                    sx={{
                      color: isActive ? "primary.main" : "text.secondary",
                      fontWeight: isActive ? 700 : 500,
                      fontSize: "0.95rem",
                      position: "relative",
                      "&::after": isActive
                        ? {
                            content: '""',
                            position: "absolute",
                            bottom: 0,
                            left: "50%",
                            transform: "translateX(-50%)",
                            width: "60%",
                            height: 2,
                            bgcolor: "primary.main",
                            borderRadius: 1,
                          }
                        : {},
                      "&:hover": {
                        color: "text.primary",
                        bgcolor: "transparent",
                      },
                    }}
                  >
                    {t(labelKey)}
                  </Button>
                );
              })}
            </Box>
          )}

          {/* Spacer on mobile */}
          {isMobile && <Box sx={{ flexGrow: 1 }} />}

          {/* Right Actions */}
          <IconButton
            onClick={() => setSearchOpen(true)}
            size="small"
            sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
          >
            <Search size={22} />
          </IconButton>
          {!isMobile && (
            <IconButton
              component={NavLink}
              to="/lists"
              size="small"
              aria-label={t("nav.myLists")}
              sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
            >
              <Bookmark size={22} />
            </IconButton>
          )}
          <AccountMenu />
        </Toolbar>
      </AppBar>

      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <Paper
          sx={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            zIndex: 1200,
            borderTop: 1,
            borderColor: "divider",
          }}
          elevation={8}
        >
          <BottomNavigation
            value={activeBottomNav}
            onChange={(_, newValue) => {
              navigate(bottomNavItems[newValue].to);
            }}
            sx={{
              bgcolor: "rgba(13, 13, 13, 0.95)",
              backdropFilter: "blur(12px)",
              "& .MuiBottomNavigationAction-root": {
                color: "text.secondary",
                minWidth: "auto",
                px: 0.5,
                py: 1,
                "&.Mui-selected": {
                  color: "primary.main",
                },
              },
              "& .MuiBottomNavigationAction-label": {
                fontSize: "0.6rem",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                "&.Mui-selected": {
                  fontSize: "0.6rem",
                },
              },
            }}
          >
            {bottomNavItems.map(({ labelKey, icon: Icon }) => (
              <BottomNavigationAction
                key={labelKey}
                label={t(labelKey)}
                icon={<Icon size={20} />}
              />
            ))}
          </BottomNavigation>
        </Paper>
      )}
    </>
  );
}
