import { Box, Typography } from "@mui/material";
import type { MediaFileOutput } from "../api/types";
import { QualityChip, type QualityChipKind } from "./QualityChip";
import { fontFamily } from "../theme/tokens";

interface QualityRailProps {
  files: MediaFileOutput[];
  resolution: string | null;
  /** Audio language labels already formatted for display (e.g. ``"pt-BR"``). */
  languages?: string[];
}

interface DerivedChip {
  label: string;
  kind: QualityChipKind;
}

function deriveChips(files: MediaFileOutput[], resolution: string | null): DerivedChip[] {
  const chips: DerivedChip[] = [];

  // The API reports resolution *names* ("4K", "1080p", "720p"), never
  // pixel dimensions — so the old "2160" match could never fire and
  // every 4K title fell through to the low-emphasis branch, rendering a
  // dim "4K" chip. Compare against the names the backend actually sends.
  const has4K = resolution === "4K" || files.some((f) => f.resolution === "4K");
  const hasHDR = files.some((f) => Boolean(f.hdr_format));

  if (has4K) {
    // "4K HDR" stays one chip: it's a recognized label, and it's exactly
    // what the card badge shows for the same title.
    chips.push({ label: hasHDR ? "4K HDR" : "4K", kind: "premium" });
  } else {
    if (resolution === "1080p") {
      chips.push({ label: "1080p", kind: "neutral" });
    } else if (resolution) {
      chips.push({ label: resolution, kind: "low" });
    }
    // HDR below 4K used to be dropped entirely, since hasHDR was only
    // read inside the 4K branch. It's orthogonal to resolution, so the
    // rail carries it as its own chip the way it already does for audio
    // and codec — matching the standalone "HDR" badge on the card.
    if (hasHDR) {
      chips.push({ label: "HDR", kind: "premium" });
    }
  }

  const allAudio = files.flatMap((f) => f.audio_tracks);
  const hasAtmos = allAudio.some((a) => {
    const codec = a.codec?.toLowerCase() ?? "";
    const title = a.title?.toLowerCase() ?? "";
    return codec.includes("truehd") || codec.includes("atmos") || title.includes("atmos");
  });
  const maxChannels = allAudio.reduce((acc, a) => Math.max(acc, a.channels ?? 0), 0);
  if (hasAtmos) {
    chips.push({ label: "Dolby Atmos", kind: "premium" });
  } else if (maxChannels >= 8) {
    chips.push({ label: "7.1", kind: "neutral" });
  } else if (maxChannels >= 6) {
    chips.push({ label: "5.1", kind: "neutral" });
  }

  const isHEVC = files.some((f) => {
    const codec = f.video_codec?.toLowerCase() ?? "";
    return codec.includes("hevc") || codec === "h265";
  });
  if (isHEVC) chips.push({ label: "HEVC", kind: "neutral" });

  return chips;
}

export function QualityRail({ files, resolution, languages }: QualityRailProps) {
  const chips = deriveChips(files, resolution);
  const hasLanguages = languages && languages.length > 0;
  if (chips.length === 0 && !hasLanguages) return null;

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
      {chips.map((c) => (
        <QualityChip key={c.label} label={c.label} kind={c.kind} />
      ))}
      {hasLanguages && (
        <Typography
          variant="caption"
          sx={{
            ml: chips.length > 0 ? 0.5 : 0,
            color: "text.secondary",
            opacity: 0.6,
            fontFamily: fontFamily.mono,
            fontSize: "0.6875rem",
          }}
        >
          {chips.length > 0 ? "· " : ""}
          {languages.join(" · ")}
        </Typography>
      )}
    </Box>
  );
}
