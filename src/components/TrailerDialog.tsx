import { Box, Dialog, IconButton } from "@mui/material";
import { X } from "lucide-react";

interface TrailerDialogProps {
  open: boolean;
  onClose: () => void;
  url: string;
}

function getYouTubeVideoId(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.replace(/^www\./, "");

    let id: string | null = null;

    if (hostname === "youtube.com") {
      id = parsed.searchParams.get("v");
      if (!id && parsed.pathname.startsWith("/embed/")) {
        id = parsed.pathname.split("/")[2] ?? null;
      }
    } else if (hostname === "youtu.be") {
      id = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (!id) return null;

    // Strip any remaining query/hash fragments
    id = id.split(/[?#]/)[0];

    return /^[A-Za-z0-9_-]+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

export function TrailerDialog({ open, onClose, url }: TrailerDialogProps) {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) return null;

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
