import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { ScrollManager } from "./ScrollManager";

export function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Effect-only component — snaps to the top on new navigation
          and restores the prior offset on back/forward. See
          `ScrollManager.tsx` for the rationale. */}
      <ScrollManager />
      <Navbar />
      <Box component="main" sx={{ pb: isMobile ? "56px" : 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
