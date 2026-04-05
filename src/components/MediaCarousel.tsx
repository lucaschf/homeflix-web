import { Box, IconButton, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";

interface MediaCarouselProps {
  title: string;
  onSeeAll?: () => void;
  children: React.ReactNode;
}

export function MediaCarousel({ title, onSeeAll, children }: MediaCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 0);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  };

  const scroll = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: { xs: 3, md: 6 },
          mb: 1.5,
        }}
      >
        <Typography variant="h2">{title}</Typography>
        {onSeeAll && (
          <Typography
            variant="body2"
            onClick={onSeeAll}
            sx={{
              color: "primary.main",
              cursor: "pointer",
              "&:hover": { textDecoration: "underline" },
            }}
          >
            See All &gt;
          </Typography>
        )}
      </Box>

      {/* Scroll Container */}
      <Box sx={{ position: "relative", "&:hover .scroll-btn": { opacity: 1 } }}>
        {/* Left Arrow */}
        {showLeft && (
          <IconButton
            className="scroll-btn"
            onClick={() => scroll("left")}
            sx={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              bgcolor: "rgba(0,0,0,0.7)",
              color: "text.primary",
              opacity: 0,
              transition: "opacity 200ms",
              "&:hover": { bgcolor: "rgba(0,0,0,0.9)" },
            }}
          >
            <ChevronLeft size={24} />
          </IconButton>
        )}

        {/* Right Arrow */}
        {showRight && (
          <IconButton
            className="scroll-btn"
            onClick={() => scroll("right")}
            sx={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              bgcolor: "rgba(0,0,0,0.7)",
              color: "text.primary",
              opacity: 0,
              transition: "opacity 200ms",
              "&:hover": { bgcolor: "rgba(0,0,0,0.9)" },
            }}
          >
            <ChevronRight size={24} />
          </IconButton>
        )}

        {/* Scrollable Row */}
        <Box
          ref={scrollRef}
          onScroll={handleScroll}
          sx={{
            display: "flex",
            gap: 2,
            overflowX: "auto",
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
            px: { xs: 3, md: 6 },
          }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
}
