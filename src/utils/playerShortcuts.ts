/**
 * The player's keyboard map, as data.
 *
 * This is what the shortcuts card renders. It is deliberately the same
 * list the ``keydown`` handler in ``Player`` implements — a card that
 * advertises a key the player doesn't answer is worse than no card, so
 * when you add a binding there, add its row here.
 *
 * The seek distances live here too, and the handler reads them from
 * here: those are the one part the card could quietly get *numerically*
 * wrong, and a wrong number is indistinguishable from a working one
 * until someone counts the seconds.
 */

// Skip distances for the seek shortcuts (keyboard ←/→ and the
// double-tap edge zones). Forward is longer than backward because
// the dominant use case for forward is skipping past commercials /
// recaps; backward tends to be "I missed a line, jump a beat".
export const BACKWARD_SEEK_SECONDS = 10;
export const FORWARD_SEEK_SECONDS = 30;

export interface Shortcut {
  /**
   * Key caps, rendered left to right. Letters and arrow glyphs read the
   * same in every language and are written literally; ``SPACE_CAP`` is
   * the one that needs translating.
   */
  keys: readonly string[];
  /** i18n key for what the shortcut does. */
  labelKey: string;
  /** Interpolation for that label — only the seek rows need it. */
  labelValues?: Readonly<Record<string, number>>;
  /** Draws the cap in the accent colour: the card's own key. */
  accent?: boolean;
}

export interface ShortcutGroup {
  titleKey: string;
  items: readonly Shortcut[];
  /**
   * Only shown while watching a series. A movie has no next episode, so
   * advertising the key would be advertising a key that does nothing.
   */
  seriesOnly?: boolean;
}

/** The cap whose label is a word, not a glyph. */
export const SPACE_CAP = "space";

export const SHORTCUT_GROUPS: readonly ShortcutGroup[] = [
  {
    titleKey: "player.shortcuts.groups.playback",
    items: [
      { keys: [SPACE_CAP, "K"], labelKey: "player.shortcuts.playPause" },
      {
        keys: ["←"],
        labelKey: "player.shortcuts.rewind",
        labelValues: { seconds: BACKWARD_SEEK_SECONDS },
      },
      {
        keys: ["→"],
        labelKey: "player.shortcuts.forward",
        labelValues: { seconds: FORWARD_SEEK_SECONDS },
      },
      { keys: ["0–9"], labelKey: "player.shortcuts.seekPercent" },
      { keys: ["<", ">"], labelKey: "player.shortcuts.speed" },
      { keys: ["Esc"], labelKey: "player.shortcuts.exit" },
    ],
  },
  {
    titleKey: "player.shortcuts.groups.episodes",
    seriesOnly: true,
    items: [
      { keys: ["N"], labelKey: "player.shortcuts.nextEpisode" },
      { keys: ["P"], labelKey: "player.shortcuts.previousEpisode" },
      { keys: ["E"], labelKey: "player.shortcuts.episodeList" },
    ],
  },
  {
    titleKey: "player.shortcuts.groups.audio",
    items: [
      { keys: ["T"], labelKey: "player.shortcuts.audioMenu" },
      { keys: ["S"], labelKey: "player.shortcuts.subtitleMenu" },
      { keys: ["B"], labelKey: "player.shortcuts.cycleAudio" },
      { keys: ["V"], labelKey: "player.shortcuts.cycleSubtitle" },
      { keys: ["↑", "↓"], labelKey: "player.shortcuts.volume" },
      { keys: ["M"], labelKey: "player.shortcuts.mute" },
    ],
  },
  {
    titleKey: "player.shortcuts.groups.display",
    items: [
      { keys: ["A"], labelKey: "player.shortcuts.cycleAspect" },
      { keys: ["C"], labelKey: "player.shortcuts.aspectMenu" },
      { keys: ["F"], labelKey: "player.shortcuts.fullscreen" },
      { keys: ["?"], labelKey: "player.shortcuts.thisCard", accent: true },
    ],
  },
];
