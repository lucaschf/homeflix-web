import { Box, Typography } from "@mui/material";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { SubtitleAppearance } from "../../hooks/usePlaybackPreferences";
import { peach } from "../../theme/colors";
import { scrim, whiteAlpha } from "../../theme/tokens";
import {
  subtitlePreviewFontSize,
  subtitleTextEdgeCss,
} from "../../utils/subtitleStyles";
import { SegmentedControl } from "../admin/SegmentedControl";

/**
 * Live subtitle preview rendered as a 16:9 player frame rather than a flat
 * strip: scene, bottom scrim, caption in the safe area and a progress bar,
 * stacked the way the player stacks them. Legibility is the whole point of
 * these settings, so the scene can be flipped between a dark and a bright
 * frame — a yellow caption with no edge reads fine over one and vanishes
 * over the other.
 *
 * The caption pulls from the same style maps as the player overlay
 * (``subtitleStyles``), so the preview can't drift from playback.
 */

type Scene = "dark" | "light";

const SCENE_BACKGROUND: Record<Scene, string> = {
  dark: "radial-gradient(120% 90% at 22% 18%, #20232B 0%, #0D0F13 55%, #050607 100%)",
  light: "radial-gradient(110% 95% at 70% 22%, #EDE3D3 0%, #BFB2A0 48%, #6E6559 100%)",
};

export function SubtitlePreview({ appearance }: { appearance: SubtitleAppearance }) {
  const { t } = useTranslation();
  const [scene, setScene] = useState<Scene>("dark");

  return (
    <Box sx={{ px: { xs: 2, sm: 2.75 }, pt: 2.25, pb: 2.5 }}>
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 1.25,
          mb: 1.25,
        }}
      >
        <Typography variant="eyebrow" color="text.secondary">
          {t("settings.preview")}
        </Typography>
        <SegmentedControl<Scene>
          value={scene}
          onChange={setScene}
          ariaLabel={t("settings.sceneLabel")}
          options={[
            { value: "dark", label: t("settings.scenes.dark") },
            { value: "light", label: t("settings.scenes.light") },
          ]}
        />
      </Box>

      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          aspectRatio: "16 / 9",
          borderRadius: 1.5,
          border: `1px solid ${whiteAlpha(0.08)}`,
          bgcolor: "#000",
        }}
      >
        <Box sx={{ position: "absolute", inset: 0, background: SCENE_BACKGROUND[scene] }} />
        {/* Bottom scrim — the player's own control gradient, which is
            what a caption actually sits on top of. */}
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            height: "34%",
            background: `linear-gradient(180deg, transparent, ${scrim(0.5)})`,
          }}
        />
        <Box
          sx={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: "9%",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <Box
            component="span"
            sx={{
              maxWidth: "80%",
              textAlign: "center",
              textWrap: "balance",
              color: appearance.color,
              backgroundColor: appearance.background,
              fontSize: subtitlePreviewFontSize[appearance.fontSize],
              fontWeight: 600,
              lineHeight: 1.28,
              px: "0.4em",
              py: "0.08em",
              borderRadius: "4px",
              textShadow: subtitleTextEdgeCss[appearance.textEdge],
            }}
          >
            {t("settings.subtitlePreviewText")}
          </Box>
        </Box>
        <Box
          sx={{
            position: "absolute",
            left: 14,
            right: 14,
            bottom: 12,
            height: 3,
            borderRadius: 99,
            bgcolor: whiteAlpha(0.22),
          }}
        >
          <Box
            sx={{
              position: "absolute",
              inset: "0 62% 0 0",
              borderRadius: 99,
              bgcolor: peach.main,
              "&::after": {
                content: '""',
                position: "absolute",
                right: -4,
                top: -2.5,
                width: 8,
                height: 8,
                borderRadius: "50%",
                bgcolor: peach.main,
              },
            }}
          />
        </Box>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25 }}>
        {t("settings.subtitlePreviewNote")}
      </Typography>
    </Box>
  );
}
