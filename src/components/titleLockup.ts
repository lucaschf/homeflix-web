import { LOGO_ASPECT } from "./titleLogoSizing";

/**
 * Title lockup — how a title without logo art is set as one, poster
 * style (think the "A VIAGEM DE / CHIHIRO" logo): all caps in Eczar
 * ExtraBold, broken into one to three lines, each line scaled to fill
 * the logo box's width so a short word grows instead of leaving a gap.
 *
 * Everything is a fraction of the box width, so the lockup is one
 * drawing that scales with its container (``cqi`` units at render).
 */

/**
 * Advance widths of Eczar ExtraBold (800), in em, for the uppercase
 * characters titles are set in — measured off the shipped font. Summing
 * them skips kerning, which only ever makes a line a touch narrower
 * (~2%), so a line sized from them never overflows.
 */
const ADVANCE_EM: Record<string, number> = {
  A: 0.741, B: 0.717, C: 0.612, D: 0.757, E: 0.67, F: 0.659, G: 0.721,
  H: 0.855, I: 0.428, J: 0.425, K: 0.787, L: 0.643, M: 1.008, N: 0.802,
  O: 0.698, P: 0.68, Q: 0.735, R: 0.746, S: 0.622, T: 0.692, U: 0.773,
  V: 0.738, W: 1.041, X: 0.727, Y: 0.702, Z: 0.689,
  "0": 0.614, "1": 0.469, "2": 0.617, "3": 0.611, "4": 0.63,
  "5": 0.582, "6": 0.599, "7": 0.527, "8": 0.591, "9": 0.592,
  " ": 0.265, ":": 0.309, ",": 0.329, ".": 0.32, "'": 0.192, "’": 0.27,
  "-": 0.5, "–": 0.588, "—": 1.049, "&": 0.712, "!": 0.366, "?": 0.661,
  "(": 0.386, ")": 0.386, "/": 0.428, "·": 0.309,
};
/** Fallback advance for a Latin-ish glyph missing from the table. */
const DEFAULT_ADVANCE_EM = 0.7;
/** Advance for full-width scripts (CJK, kana, hangul), set by the fallback font. */
const WIDE_ADVANCE_EM = 1;
const WIDE_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

/** Line height of the lockup, unitless — caps have no descenders, so lines sit tight, like a logo. */
export const LOCKUP_LINE_HEIGHT = 0.9;

/** An extra line is only taken when it sets the title this much bigger. */
const EXTRA_LINE_GAIN = 1.15;
/** The biggest line is at most this many times the smallest. */
const LINE_RATIO_MAX = 1.6;
/** Split cost for a line opening on a lowercase connector ("de", "in", "of"). */
const CONNECTOR_PENALTY = 0.5;
/** Split bonus for breaking after a colon or dash, the title's own seam. */
const SEAM_BONUS = 0.3;

/** The space a lockup is set in, every size a fraction of its width. */
export interface LockupFrame {
  /** Height the lockup may take. */
  maxHeight: number;
  /** Size cap for one line, so a short word doesn't balloon. */
  lineMax: number;
  /** Most lines the title may break into. */
  maxLines: number;
  /** A multi-word title stays on one line when that sets it at least this big. */
  oneLineMin: number;
  /** Once every line is at least this big, no further line is tried. */
  settleSize: number;
}

/**
 * The hero / detail-header frame: the logo box, so a title with no
 * logo fills the same footprint its logo would.
 */
export const LOGO_FRAME: LockupFrame = {
  maxHeight: 1 / LOGO_ASPECT,
  lineMax: 0.22,
  maxLines: 3,
  oneLineMin: 0.12,
  settleSize: 0.075,
};

export interface TitleLockup {
  /**
   * The title's display lines, in its original case (the card
   * uppercases them) — minus any separator dash a break made redundant.
   */
  lines: string[];
  /** Each line's font size, as a fraction of the lockup width. */
  sizes: number[];
}

/** Width of ``text`` set in caps, in em. */
export function lineEm(text: string): number {
  let em = 0;
  for (const ch of text.toUpperCase()) {
    const base = ch.normalize("NFD").replace(/\p{M}/gu, "");
    em += ADVANCE_EM[base] ?? (WIDE_SCRIPT.test(ch) ? WIDE_ADVANCE_EM : DEFAULT_ADVANCE_EM);
  }
  return em;
}

/** Font size per line (fraction of width): fill the width, then fit the frame. */
function sizeLines(lines: string[], frame: LockupFrame): number[] {
  const fill = lines.map((line) => Math.min(frame.lineMax, 1 / Math.max(lineEm(line), 0.01)));
  const ceiling = Math.min(...fill) * LINE_RATIO_MAX;
  const sizes = fill.map((size) => Math.min(size, ceiling));
  const height = sizes.reduce((sum, size) => sum + size * LOCKUP_LINE_HEIGHT, 0);
  const fit = Math.min(1, frame.maxHeight / height);
  return sizes.map((size) => size * fit);
}

/**
 * A line that can't stand alone: one short word ("A", "DO", "3") or a
 * lowercase connector ("dos", "the") left on a line of its own.
 */
function isOrphan(line: string[]): boolean {
  if (line.length > 1) return false;
  const word = line[0];
  return word.replace(/[^\p{L}\p{N}]/gu, "").length <= 2 || /^\p{Ll}/u.test(word);
}

/** A dash standing between a title and its subtitle ("Skeeters - Asas da Morte"). */
const SEPARATOR = /^[-–—]$/;

/**
 * Drop a separator dash a break has left at the end of a line — the
 * break already does its job, so "SKEETERS / ASAS DA MORTE".
 */
function dropSeamDashes(lines: string[][]): string[][] {
  return lines.map((words, i) =>
    i < lines.length - 1 && words.length > 1 && SEPARATOR.test(words.at(-1)!) ? words.slice(0, -1) : words,
  );
}

/**
 * How poorly ``lines`` read as a lockup: uneven widths and awkward
 * breaks. A split that orphans a word is ruled out entirely.
 */
function splitCost(lines: string[][]): number {
  if (lines.some(isOrphan)) return Infinity;
  const widths = dropSeamDashes(lines).map((words) => lineEm(words.join(" ")));
  let cost = Math.log(Math.max(...widths) / Math.min(...widths));
  for (let i = 1; i < lines.length; i++) {
    const opener = lines[i][0];
    if (/^\p{Ll}/u.test(opener) || /^[-–—]/.test(opener)) cost += CONNECTOR_PENALTY;
    if (/[:\-–—]$/.test(lines[i - 1].at(-1)!)) cost -= SEAM_BONUS;
  }
  return cost;
}

/** Every way to cut ``words`` into ``count`` non-empty runs, in order. */
function* splits(words: string[], count: number): Generator<string[][]> {
  if (count === 1) {
    yield [words];
    return;
  }
  for (let cut = 1; cut <= words.length - count + 1; cut++) {
    for (const rest of splits(words.slice(cut), count - 1)) yield [words.slice(0, cut), ...rest];
  }
}

/** The best way to set ``words`` on ``count`` lines, or ``null`` when every way orphans a word. */
function bestSplit(words: string[], count: number): string[] | null {
  let best: string[][] | null = null;
  let bestCost = Infinity;
  for (const lines of splits(words, count)) {
    const cost = splitCost(lines);
    if (cost < bestCost) [best, bestCost] = [lines, cost];
  }
  return best && dropSeamDashes(best).map((line) => line.join(" "));
}

/** Lay ``title`` out as a lockup in ``frame``: its lines and their sizes. */
export function titleLockup(title: string, frame: LockupFrame = LOGO_FRAME): TitleLockup {
  const words = title.trim().split(/\s+/);
  const layout = (lines: string[]) => {
    const sizes = sizeLines(lines, frame);
    return { lines, sizes, smallest: Math.min(...sizes) };
  };

  const one = layout([words.join(" ")]);
  if (words.length === 1 || one.smallest >= frame.oneLineMin) return one;

  // Past one line, each extra line has to earn its place: it's tried
  // only while the lines are still small, and kept only when it sets
  // the title clearly bigger.
  const two = bestSplit(words, 2);
  if (!two) return one;
  let best = layout(two);
  for (let count = 3; count <= Math.min(frame.maxLines, words.length); count++) {
    if (best.smallest >= frame.settleSize) break;
    const split = bestSplit(words, count);
    if (!split) break;
    const next = layout(split);
    if (next.smallest < best.smallest * EXTRA_LINE_GAIN) break;
    best = next;
  }
  return best;
}
