// Placeholder — the Variation B login screen lands in the next
// PR. Existing here so the ``/login`` route resolves and future
// guards can redirect to it without restructuring App.tsx.

import { Box, Typography } from "@mui/material";

export function Login() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: 3,
      }}
    >
      <Typography variant="body1" color="text.secondary">
        Login coming soon.
      </Typography>
    </Box>
  );
}
