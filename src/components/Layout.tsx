import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { Navbar } from "./Navbar";

export function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      <Navbar />
      <Box component="main" sx={{ pb: isMobile ? "56px" : 0 }}>
        <Outlet />
      </Box>
    </Box>
  );
}
