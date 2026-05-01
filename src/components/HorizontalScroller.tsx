import { Box, IconButton } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface HorizontalScrollerProps {
  children: React.ReactNode;
}

/**
 * Minimal horizontal scroll row with fade-in chevron buttons.
 *
 * Same visual mechanics as ``MediaCarousel`` but without the section
 * header / "see all" link / infinite-scroll sentinel — meant for
 * sub-scrollers that already live inside a section header (e.g. the
 * episode cards under the season tabs on the series detail page).
 *
 * Arrows hide when the row hasn't overflowed and at the respective
 * edges of the scroll, and only fade in while the row is hovered so
 * a passive user sees a clean strip of cards.
 */
export function HorizontalScroller({ children }: HorizontalScrollerProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const update = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 0);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 10);
  }, []);

  // Re-check on mount, on container resize, and whenever the children
  // count changes (a new season swap can shrink the row below the
  // overflow threshold and the right arrow needs to disappear).
  const childCount = React.Children.count(children);
  useEffect(() => {
    update();
    const el = scrollRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [update, childCount]);

  const scrollBy = (direction: "left" | "right") => {
    const el = scrollRef.current;
    if (!el) return;
    const amount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === "left" ? -amount : amount,
      behavior: "smooth",
    });
  };

  return (
    <Box sx={{ position: "relative", "&:hover .h-scroll-btn": { opacity: 1 } }}>
      {showLeft && (
        <IconButton
          className="h-scroll-btn"
          onClick={() => scrollBy("left")}
          aria-label={t("common.scrollLeft")}
          sx={{
            position: "absolute",
            left: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 2,
            color: "overlayText.secondary",
            opacity: 0,
            transition: "opacity 200ms",
            "&:hover": { color: "overlayText.primary", bgcolor: "transparent" },
          }}
        >
          <ChevronLeft size={32} />
        </IconButton>
      )}
      {showRight && (
        <IconButton
          className="h-scroll-btn"
          onClick={() => scrollBy("right")}
          aria-label={t("common.scrollRight")}
          sx={{
            position: "absolute",
            right: 0,
            top: "50%",
            transform: "translateY(-50%)",
            zIndex: 2,
            color: "overlayText.secondary",
            opacity: 0,
            transition: "opacity 200ms",
            "&:hover": { color: "overlayText.primary", bgcolor: "transparent" },
          }}
        >
          <ChevronRight size={32} />
        </IconButton>
      )}
      <Box
        ref={scrollRef}
        onScroll={update}
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
          pb: 1,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
