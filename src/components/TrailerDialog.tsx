import { Box, Dialog, IconButton } from "@mui/material";
import { X } from "lucide-react";

interface TrailerDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
}

export function TrailerDialog({ open, onClose, url }: TrailerDialogProps) {
  // Extract YouTube video ID from URL
  const videoId = url.match(/[?&]v=([^&]+)/)?.[1] ?? url.split("/").pop() ?? "";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      slotProps={{
        paper: {
          sx: { bgcolor: "#000", overflow: "hidden", borderRadius: 2 },
        },
      }}
    >
      <IconButton
        onClick={onClose}
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          zIndex: 1,
          color: "#fff",
          bgcolor: "rgba(0,0,0,0.5)",
          "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
        }}
      >
        <X size={20} />
      </IconButton>
      <Box sx={{ position: "relative", width: "100%", aspectRatio: "16/9" }}>
        <Box
          component="iframe"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            border: "none",
          }}
        />
      </Box>
    </Dialog>
  );
}
