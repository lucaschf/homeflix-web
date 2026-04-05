import {
  AppBar,
  Box,
  Toolbar,
  Button,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Search } from "lucide-react";
import { SIDEBAR_WIDTH, SIDEBAR_COLLAPSED } from "./Sidebar";

export function TopBar() {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("lg"));
  const sidebarWidth = isDesktop ? SIDEBAR_WIDTH : SIDEBAR_COLLAPSED;

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        width: `calc(100% - ${sidebarWidth}px)`,
        ml: `${sidebarWidth}px`,
      }}
    >
      <Toolbar>
        <Box sx={{ flexGrow: 1 }} />
        <Button
          startIcon={<Search size={16} />}
          sx={{
            color: "text.secondary",
            bgcolor: "background.default",
            "&:hover": { bgcolor: "action.hover", color: "text.primary" },
            px: 2,
          }}
        >
          Search
          <Typography
            component="kbd"
            variant="caption"
            sx={{
              ml: 1,
              px: 0.75,
              py: 0.25,
              borderRadius: 0.5,
              bgcolor: "background.default",
              border: 1,
              borderColor: "divider",
              display: { xs: "none", md: "inline" },
            }}
          >
            Ctrl+K
          </Typography>
        </Button>
      </Toolbar>
    </AppBar>
  );
}
