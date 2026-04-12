import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";
import { ScrollToTop } from "./ScrollToTop";

export function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* Effect-only component — resets window scroll on every
          route change so tab switches land at the top of the new
          content instead of mid-feed. See `ScrollToTop.tsx` for
          the rationale. */}
      <ScrollToTop />
      <Navbar />
      <Box component="main" sx={{ pb: isMobile ? "56px" : 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
