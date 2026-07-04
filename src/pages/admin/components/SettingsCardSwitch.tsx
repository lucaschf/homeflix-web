import type {
  AdminSettingDetail,
  AvatarSettings,
  CreditsDetectionSettings,
  IntroDetectionSettings,
  ScanDedupSettings,
  SchedulerSettings,
  StreamingSettings,
  SubtitleOcrSettings,
  ThumbnailBackfillSettings,
} from "../../../api/types";
import { AvatarSettingsCard } from "./AvatarSettingsCard";
import { CreditsDetectionSettingsCard } from "./CreditsDetectionSettingsCard";
import { IntroDetectionSettingsCard } from "./IntroDetectionSettingsCard";
import { ScanDedupSettingsCard } from "./ScanDedupSettingsCard";
import { SchedulerSettingsCard } from "./SchedulerSettingsCard";
import { StreamingSettingsCard } from "./StreamingSettingsCard";
import { SubtitleOcrSettingsCard } from "./SubtitleOcrSettingsCard";
import { ThumbnailBackfillSettingsCard } from "./ThumbnailBackfillSettingsCard";

interface Props {
  detail: AdminSettingDetail;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

/**
 * Maps an ``AdminSettingDetail`` to its typed bucket card. Kept as a
 * single dispatcher so the ``value`` cast for each bucket lives in
 * one place and both layouts (rail + accordion) render sections the
 * same way.
 */
export function SettingsCardSwitch({ detail, onSuccess, onError }: Props) {
  const common = { onSuccess, onError };
  switch (detail.key) {
    case "scheduler":
      return (
        <SchedulerSettingsCard
          detail={{ ...detail, value: detail.value as SchedulerSettings }}
          {...common}
        />
      );
    case "thumbnail_backfill":
      return (
        <ThumbnailBackfillSettingsCard
          detail={{ ...detail, value: detail.value as ThumbnailBackfillSettings }}
          {...common}
        />
      );
    case "intro_detection":
      return (
        <IntroDetectionSettingsCard
          detail={{ ...detail, value: detail.value as IntroDetectionSettings }}
          {...common}
        />
      );
    case "credits_detection":
      return (
        <CreditsDetectionSettingsCard
          detail={{ ...detail, value: detail.value as CreditsDetectionSettings }}
          {...common}
        />
      );
    case "streaming":
      return (
        <StreamingSettingsCard
          detail={{ ...detail, value: detail.value as StreamingSettings }}
          {...common}
        />
      );
    case "avatar":
      return (
        <AvatarSettingsCard
          detail={{ ...detail, value: detail.value as AvatarSettings }}
          {...common}
        />
      );
    case "scan_dedup":
      return (
        <ScanDedupSettingsCard
          detail={{ ...detail, value: detail.value as ScanDedupSettings }}
          {...common}
        />
      );
    case "subtitle_ocr":
      return (
        <SubtitleOcrSettingsCard
          detail={{ ...detail, value: detail.value as SubtitleOcrSettings }}
          {...common}
        />
      );
    default:
      return null;
  }
}
