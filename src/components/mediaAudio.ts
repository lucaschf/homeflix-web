/**
 * Subtitled-only derivation for the card badge, kept out of
 * ``MediaCard.tsx`` for the same Fast Refresh reason as
 * ``mediaQuality.ts``.
 */

// Code the backend prober stores for an audio track with no language
// tag. Such a track may well be the dub, so it makes the answer unknown.
const UNDETERMINED_LANGUAGE = "un";

/**
 * Whether a title can only be watched with subtitles by this viewer —
 * none of its audio tracks speaks their preferred audio language.
 *
 * Silent (``false``) whenever it can't be sure, since a wrong "LEG" on
 * a dubbed title is worse than a missing one: no probed tracks yet, an
 * untagged track, or no preference loaded.
 *
 * @param audioLanguages ISO 639-1 codes of every audio track behind the
 *   card, as the API reports them (``["en", "pt"]``).
 * @param preferredAudioLang The profile's preferred audio language as a
 *   BCP 47 tag (``"pt-BR"``); compared on its primary subtag, the way
 *   the backend picks the default track.
 */
export function isSubtitledOnly(
  audioLanguages: readonly string[] | undefined,
  preferredAudioLang: string | undefined,
): boolean {
  if (!audioLanguages?.length || !preferredAudioLang) return false;
  if (audioLanguages.includes(UNDETERMINED_LANGUAGE)) return false;
  const preferred = preferredAudioLang.toLowerCase().split("-")[0];
  return !audioLanguages.includes(preferred);
}
