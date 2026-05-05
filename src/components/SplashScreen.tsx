import { useEffect, useState } from "react";
import { Box } from "@mui/material";
import { useTheme } from "@mui/material/styles";

interface SplashScreenProps {
  /** Fired after the exit animation completes — caller unmounts here. */
  onDone: () => void;
  /** How long the splash stays visible before the exit fade kicks in. */
  holdMs?: number;
  /** Length of the fade-out covering the splash → app handoff. */
  exitMs?: number;
}

/**
 * Boot splash with the Chimney-Play mark animating in.
 *
 * The choreography mirrors the design handoff's general intro spec
 * (handoff README §"Animated Intro Specs"):
 *
 *   0–25%     walls slide up from the bottom of the silhouette
 *   25–45%    roof scales from its apex
 *   45–60%    peach chimney pops up over the roof
 *   55–80%    "HomeFlix" wordmark slides in from the left + fades up
 *   80–100%   hold, then a single fade-out covers the handoff
 *
 * Click anywhere to skip — useful for dev iteration and for users
 * who've seen it once already this session. Background is the page
 * bg, so removing the splash leaves no flash against the routed
 * content underneath.
 */
export function SplashScreen({ onDone, holdMs = 2200, exitMs = 360 }: SplashScreenProps) {
  const theme = useTheme();
  const peach = theme.palette.primary.main;
  const fg = theme.palette.text.primary;
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setExiting(true), holdMs);
    return () => window.clearTimeout(t);
  }, [holdMs]);

  useEffect(() => {
    if (!exiting) return;
    const t = window.setTimeout(onDone, exitMs);
    return () => window.clearTimeout(t);
  }, [exiting, exitMs, onDone]);

  const skip = () => setExiting(true);

  return (
    <Box
      role="presentation"
      onClick={skip}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 2,
        bgcolor: "background.default",
        cursor: "pointer",
        opacity: exiting ? 0 : 1,
        transition: `opacity ${exitMs}ms ease`,
        // Whole document keyframes — keeping them in the same Box's
        // ``sx`` lets MUI scope them through emotion so they don't
        // leak into other components or stick around after unmount.
        "@keyframes splashWallsUp": {
          "0%": { transform: "scaleY(0)", transformOrigin: "bottom" },
          "100%": { transform: "scaleY(1)", transformOrigin: "bottom" },
        },
        "@keyframes splashRoofIn": {
          "0%": { transform: "scale(0)", transformOrigin: "100px 50px", opacity: 0 },
          "100%": { transform: "scale(1)", transformOrigin: "100px 50px", opacity: 1 },
        },
        "@keyframes splashChimneyPop": {
          "0%": { transform: "translateY(20px) scale(0.6)", opacity: 0 },
          "60%": { transform: "translateY(-2px) scale(1.05)", opacity: 1 },
          "100%": { transform: "translateY(0) scale(1)", opacity: 1 },
        },
        "@keyframes splashWordmarkIn": {
          "0%": { transform: "translateX(-24px)", opacity: 0 },
          "100%": { transform: "translateX(0)", opacity: 1 },
        },
      }}
    >
      <Box
        component="svg"
        viewBox="0 0 200 200"
        xmlns="http://www.w3.org/2000/svg"
        role="img"
        aria-label="HomeFlix"
        // Bumped from a fixed 160px to a responsive scale: small
        // phones get a 160px mark (room for the wordmark below it
        // in a tall viewport), desktops get 220px so the logo
        // doesn't read as a tiny floating glyph on a 1080p+ screen.
        sx={{ width: { xs: 160, sm: 200, md: 220 }, height: { xs: 160, sm: 200, md: 220 } }}
      >
        {/* House body — slides up from the floor */}
        <rect
          x="36"
          y="98"
          width="128"
          height="78"
          rx="10"
          fill={fg}
          style={{
            animation: "splashWallsUp 360ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both",
          }}
        />
        {/* Roof — scales in from the apex once the walls land */}
        <path
          d="M 28 106 L 100 50 L 172 106 Z"
          fill={fg}
          style={{
            animation: "splashRoofIn 320ms cubic-bezier(0.22, 1, 0.36, 1) 280ms both",
          }}
        />
        {/* Chimney = peach play arrow — pops up after the roof seats */}
        <path
          d="M 130 86 L 130 36 L 168 60 Z"
          fill={peach}
          style={{
            animation: "splashChimneyPop 360ms cubic-bezier(0.22, 1, 0.36, 1) 540ms both",
          }}
        />
        {/* Window — fades with the walls */}
        <rect
          x="84"
          y="124"
          width="32"
          height="32"
          rx="3"
          fill={theme.palette.background.default}
          style={{
            animation: "splashWallsUp 360ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both",
          }}
        />
        <line
          x1="100"
          y1="124"
          x2="100"
          y2="156"
          stroke={fg}
          strokeWidth="2"
          style={{
            animation: "splashWallsUp 360ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both",
          }}
        />
        <line
          x1="84"
          y1="140"
          x2="116"
          y2="140"
          stroke={fg}
          strokeWidth="2"
          style={{
            animation: "splashWallsUp 360ms cubic-bezier(0.22, 1, 0.36, 1) 0ms both",
          }}
        />
      </Box>

      <Box
        sx={{
          fontFamily: "'Space Grotesk', 'Inter', system-ui, sans-serif",
          // Bumped from a flat 1.75rem (28px) — at the new logo
          // sizes the old wordmark read as a footnote. The
          // responsive scale keeps the logo:wordmark ratio stable
          // around ~3:1 across breakpoints.
          fontSize: { xs: "2rem", sm: "2.5rem", md: "3rem" },
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: fg,
          animation: "splashWordmarkIn 420ms cubic-bezier(0.22, 1, 0.36, 1) 900ms both",
        }}
      >
        Home
        <Box component="span" sx={{ color: peach }}>
          Flix
        </Box>
      </Box>
    </Box>
  );
}
