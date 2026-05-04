import type { ReactNode } from "react";
import { Box } from "@mui/material";

/**
 * Full-bleed dark surface used by every auth screen.
 *
 * Two stacked peach radial halos (top centre + bottom centre) and a
 * subtle SVG grain at 40% opacity / overlay blend mode reproduce
 * the cinematographic backdrop from the Variação B mock without
 * touching the host app's standard ``Layout``. Children get
 * ``position: relative`` so chrome (logos, buttons) sits above the
 * background layers.
 *
 * Halos use peach with low alpha (0.10 / 0.05) — dark enough that
 * the form remains the visual anchor, peach enough that the brand
 * accent reads from the very first frame.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        position: "relative",
        minHeight: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Halo gradients */}
      <Box
        aria-hidden
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse 800px 500px at 50% 30%, rgba(217,119,87,0.10), transparent 65%),
            radial-gradient(ellipse 600px 400px at 50% 100%, rgba(217,119,87,0.05), transparent 60%)
          `,
        }}
      />
      {/* Subtle film grain */}
      <Box
        aria-hidden
        component="svg"
        sx={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          opacity: 0.4,
          pointerEvents: "none",
          mixBlendMode: "overlay",
        }}
      >
        <filter id="auth-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} />
          <feColorMatrix values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.06 0" />
        </filter>
        <rect width="100%" height="100%" filter="url(#auth-grain)" />
      </Box>

      {/* Content sits above the background layers */}
      <Box sx={{ position: "relative", display: "flex", flexDirection: "column", flex: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
