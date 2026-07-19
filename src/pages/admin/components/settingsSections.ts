import type { LucideIcon } from "lucide-react";
import {
  Captions,
  Clapperboard,
  Clock,
  Copy,
  Cpu,
  HardDriveDownload,
  Image as ImageIcon,
  Music,
  UserCircle,
} from "lucide-react";
import type { TFunction } from "i18next";
import type { AdminSettingKey } from "../../../api/types";

/** Section scope — mirrors the design's ``PADRÃO`` / ``ADMIN`` badges. */
export type SettingsScope = "default" | "admin";

export interface SettingsSectionMeta {
  id: AdminSettingKey;
  icon: LucideIcon;
  scope: SettingsScope;
  /** i18n key namespace under ``admin.settings`` (e.g. ``scheduler``). */
  i18n: string;
}

/**
 * Canonical order + metadata for the runtime-settings sections,
 * driving the rail nav, the accordion headers and the search index.
 * Kept next to the cards so the icon/scope shown in the nav matches
 * the icon each ``SettingsCardShell`` renders in its own header.
 *
 * The seven design-handoff sections come first in the handoff order;
 * Subtitle OCR (ADR-027, not in the handoff) is appended as its own
 * ADMIN section at the end.
 */
export const SETTINGS_SECTIONS: SettingsSectionMeta[] = [
  { id: "scheduler", icon: Clock, scope: "default", i18n: "scheduler" },
  { id: "thumbnail_backfill", icon: ImageIcon, scope: "admin", i18n: "thumbnailBackfill" },
  { id: "intro_detection", icon: Music, scope: "admin", i18n: "introDetection" },
  { id: "credits_detection", icon: Clapperboard, scope: "admin", i18n: "creditsDetection" },
  { id: "streaming", icon: Cpu, scope: "admin", i18n: "streaming" },
  { id: "avatar", icon: UserCircle, scope: "default", i18n: "avatar" },
  { id: "scan_dedup", icon: Copy, scope: "admin", i18n: "scanDedup" },
  { id: "subtitle_ocr", icon: Captions, scope: "admin", i18n: "subtitleOcr" },
  { id: "artwork_mirror", icon: HardDriveDownload, scope: "admin", i18n: "artworkMirror" },
];

export const sectionTitle = (t: TFunction, m: SettingsSectionMeta): string =>
  t(`admin.settings.${m.i18n}.title`);

export const sectionSummary = (t: TFunction, m: SettingsSectionMeta): string =>
  t(`admin.settings.${m.i18n}.summary`);

export const sectionSubtitle = (t: TFunction, m: SettingsSectionMeta): string =>
  t(`admin.settings.${m.i18n}.subtitle`);

/**
 * True when the section matches the free-text query against its
 * title, one-line summary and fuller subtitle (all localised).
 */
export function sectionMatches(
  t: TFunction,
  m: SettingsSectionMeta,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [sectionTitle(t, m), sectionSummary(t, m), sectionSubtitle(t, m)]
    .join(" ")
    .toLowerCase()
    .includes(q);
}
