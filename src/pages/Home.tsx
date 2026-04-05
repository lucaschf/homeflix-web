import { Box, Button, Typography } from "@mui/material";
import { Film, FolderOpen } from "lucide-react";

export function Home() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        textAlign: "center",
      }}
    >
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 3,
          bgcolor: "primary.alpha12",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          mb: 3,
        }}
      >
        <Film size={32} color="#E8926F" />
      </Box>

      <Typography variant="h1" gutterBottom>
        Welcome to HomeFlix
      </Typography>

      <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 400, mb: 4 }}>
        Add a library to get started. Point to a folder with your movies and
        series, and we'll do the rest.
      </Typography>

      <Button variant="contained" startIcon={<FolderOpen size={20} />} size="large">
        Add Library
      </Button>
    </Box>
  );
}
