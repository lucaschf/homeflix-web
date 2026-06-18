import { Box, Dialog, IconButton } from "@mui/material";
import { X } from "lucide-react";
import { scrim } from "../theme/tokens";

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
      maxWidth={false}
      fullWidth
      slotProps={{
        paper: {
          sx: {
            bgcolor: "common.black",
            overflow: "hidden",
            borderRadius: 2,
            width: { xs: "95vw", md: "90vw" },
            maxWidth: 1200,
          },
        },
      }}
    >
      {/* Header bar with the close button kept above the video so it
          never overlaps the YouTube player's own top-right controls
          (settings / captions / mute). Mirrors TMDB's trailer modal. */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          px: 1,
          py: 0.5,
          bgcolor: "common.black",
        }}
      >
        <IconButton
          onClick={onClose}
          sx={{
            color: "overlayText.primary",
            "&:hover": { bgcolor: scrim(0.7) },
          }}
        >
          <X size={20} />
        </IconButton>
      </Box>
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
