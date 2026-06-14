import { Box } from "@mui/material";
import { Logo } from "../Logo";
import { peachAlpha } from "../../theme/tokens";

/**
 * The 56×56 peach-tinted square that sits above the login title in
 * the Variação B layout. Wraps the existing ``Logo`` SVG so the
 * brand mark stays in one place — the auth screens just provide
 * the framing.
 */
export function MarkBadge({ size = 56 }: { size?: number }) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 1.5,
        bgcolor: peachAlpha(0.08),
        border: `1px solid ${peachAlpha(0.25)}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Logo size={Math.round(size * 0.5)} simplified />
    </Box>
  );
}
