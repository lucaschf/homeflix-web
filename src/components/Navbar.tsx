import {
  AppBar,
  Box,
  Button,
  IconButton,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Film, Search, Settings } from "lucide-react";
import { useTranslation } from "react-i18next";
import { NavLink, useLocation } from "react-router-dom";
import { LanguageSwitch } from "./language-switch/LanguageSwitch";

const navItems = [
  { to: "/", labelKey: "nav.home" },
  { to: "/browse", labelKey: "nav.browse" },
  { to: "/lists", labelKey: "nav.myLists" },
  { to: "/history", labelKey: "nav.history" },
];

export function Navbar() {
  const { t } = useTranslation();
  const theme = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
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
            mr: 4,
          }}
        >
          <Film size={28} color={theme.palette.primary.main} />
          {!isMobile && (
            <Typography variant="h3" noWrap>
              HomeFlix
            </Typography>
          )}
        </Box>

        {/* Nav Links */}
        <Box sx={{ display: "flex", gap: 0.5, flexGrow: 1 }}>
          {navItems.map(({ to, labelKey }) => {
            const isActive = location.pathname === to;
            return (
              <Button
                key={to}
                component={NavLink}
                to={to}
                size="small"
                sx={{
                  color: isActive ? "primary.main" : "text.secondary",
                  fontWeight: isActive ? 700 : 400,
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

        {/* Right Actions */}
        <IconButton
          size="small"
          sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
        >
          <Search size={20} />
        </IconButton>
        <LanguageSwitch />
        <IconButton
          component={NavLink}
          to="/settings"
          size="small"
          sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
        >
          <Settings size={20} />
        </IconButton>
      </Toolbar>
    </AppBar>
  );
}
