// Placeholder — the Variation B profile picker lands in the next
// PR. Existing here so the ``/profiles`` route resolves and the
// post-login redirect target is in place ahead of the UI work.

import { Box, Typography } from "@mui/material";

export function Profiles() {
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
        Profile picker coming soon.
      </Typography>
    </Box>
  );
}
