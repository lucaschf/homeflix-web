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

  const has4K =
    (resolution ?? "").includes("2160") ||
    files.some((f) => f.resolution.includes("2160"));
  const hasHDR = files.some((f) => Boolean(f.hdr_format));

  if (has4K) {
    chips.push({ label: hasHDR ? "4K HDR" : "4K", kind: "premium" });
  } else if ((resolution ?? "").includes("1080")) {
    chips.push({ label: "1080p", kind: "neutral" });
  } else if (resolution) {
    chips.push({ label: resolution, kind: "low" });
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
