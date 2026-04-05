import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  Film,
  Home,
  List as ListIcon,
  Clock,
  Settings,
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

const SIDEBAR_WIDTH = 240;
const SIDEBAR_COLLAPSED = 64;

const navItems = [
  { to: "/", icon: Home, label: "Home" },
  { to: "/browse", icon: Film, label: "Browse" },
  { to: "/lists", icon: ListIcon, label: "My Lists" },
  { to: "/history", icon: Clock, label: "History" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const location = useLocation();

  const width = isDesktop ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED;

  return (
    <Drawer
      variant="permanent"
      sx={{
        width,
        flexShrink: 0,
        "& .MuiDrawer-paper": { width, boxSizing: "border-box" },
      }}
    >
      <Box
        sx={{
          height: 64,
          display: "flex",
          alignItems: "center",
          px: 2,
          gap: 1.5,
        }}
      >
        <Film size={28} color={theme.palette.primary.main} />
        {isDesktop && (
          <Typography variant="h3" noWrap>
            HomeFlix
          </Typography>
        )}
      </Box>

      <List sx={{ px: 1, mt: 2 }}>
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          return (
            <ListItemButton
              key={to}
              component={NavLink}
              to={to}
              selected={isActive}
              sx={{
                borderRadius: 1,
                mb: 0.5,
                color: isActive ? "primary.main" : "text.secondary",
                "&.Mui-selected": {
                  bgcolor: "primary.alpha12",
                  color: "primary.main",
                  "&:hover": { bgcolor: "primary.alpha12" },
                },
                "&:hover": { bgcolor: "action.hover" },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: isDesktop ? 40 : "unset",
                  color: "inherit",
                }}
              >
                <Icon size={20} />
              </ListItemIcon>
              {isDesktop && <ListItemText primary={label} />}
            </ListItemButton>
          );
        })}
      </List>
    </Drawer>
  );
}

export { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED };
