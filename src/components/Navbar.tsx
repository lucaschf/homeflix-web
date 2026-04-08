import { useCallback, useEffect, useState } from "react";
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
import { Bookmark, Film, Home, Monitor, Search, Settings, Tv } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { LanguageSwitch } from "./language-switch/LanguageSwitch";
import { SearchOverlay } from "./SearchOverlay";

const navItems = [
  { to: "/", labelKey: "nav.home" },
  { to: "/browse?type=movie", labelKey: "nav.movies" },
  { to: "/browse?type=series", labelKey: "nav.series" },
];

const bottomNavItems = [
  { to: "/", labelKey: "nav.home", icon: Home },
  { to: "/browse?type=movie", labelKey: "nav.movies", icon: Film },
  { to: "/browse?type=series", labelKey: "nav.series", icon: Tv },
  { to: "/settings", labelKey: "nav.settings", icon: Settings },
];

function getActiveBottomNav(pathname: string, search: string): number {
  const params = new URLSearchParams(search);
  if (pathname === "/") return 0;
  if (pathname === "/browse" && params.get("type") === "movie") return 1;
  if (pathname === "/browse" && params.get("type") === "series") return 2;
  if (pathname === "/settings") return 3;
  return -1;
}

export function Navbar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [searchOpen, setSearchOpen] = useState(false);

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

  const activeBottomNav = getActiveBottomNav(location.pathname, location.search);

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
            <Monitor size={isMobile ? 24 : 30} color={theme.palette.primary.main} />
            {!isMobile && (
              <Typography variant="h3" noWrap>
                HomeFlix
              </Typography>
            )}
          </Box>

          {/* Desktop Nav Links — hidden on mobile */}
          {!isMobile && (
            <Box sx={{ display: "flex", gap: 0.5, flexGrow: 1 }}>
              {navItems.map(({ to, labelKey }) => {
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
          <LanguageSwitch />
          {!isMobile && (
            <IconButton
              component={NavLink}
              to="/settings"
              size="small"
              sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
            >
              <Settings size={20} />
            </IconButton>
          )}
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
                minWidth: 0,
                py: 1,
                "&.Mui-selected": {
                  color: "primary.main",
                },
              },
              "& .MuiBottomNavigationAction-label": {
                fontSize: "0.65rem",
                "&.Mui-selected": {
                  fontSize: "0.65rem",
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
