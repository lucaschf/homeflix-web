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

/** A line never gets taller than this fraction of the width. */
const LINE_MAX = 0.22;
/** A multi-word title stays on one line when that sets it at least this big. */
const ONE_LINE_MIN = 0.12;
/** Two lines smaller than this try a third line. */
const TWO_LINE_MIN = 0.075;
/** ...which is only taken when it sets the title this much bigger. */
const THREE_LINE_GAIN = 1.15;
/** The biggest line is at most this many times the smallest. */
const LINE_RATIO_MAX = 1.6;
/** The lockup's height budget: the logo box's, so both fill the same footprint. */
const MAX_HEIGHT = 1 / LOGO_ASPECT;
/** Split cost for a line opening on a lowercase connector ("de", "in", "of"). */
const CONNECTOR_PENALTY = 0.5;
/** Split bonus for breaking after a colon or dash, the title's own seam. */
const SEAM_BONUS = 0.3;

export interface TitleLockup {
  /** The title's display lines, in its original case (the card uppercases them). */
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

/** Font size per line (fraction of width): fill the width, then fit the box. */
function sizeLines(lines: string[]): number[] {
  const fill = lines.map((line) => Math.min(LINE_MAX, 1 / Math.max(lineEm(line), 0.01)));
  const ceiling = Math.min(...fill) * LINE_RATIO_MAX;
  const sizes = fill.map((size) => Math.min(size, ceiling));
  const height = sizes.reduce((sum, size) => sum + size * LOCKUP_LINE_HEIGHT, 0);
  const fit = Math.min(1, MAX_HEIGHT / height);
  return sizes.map((size) => size * fit);
}

/** How poorly ``lines`` read as a lockup: uneven widths and awkward breaks. */
function splitCost(lines: string[][]): number {
  const widths = lines.map((words) => lineEm(words.join(" ")));
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

function bestSplit(words: string[], count: number): string[] {
  let best: string[][] = [];
  let bestCost = Infinity;
  for (const lines of splits(words, count)) {
    const cost = splitCost(lines);
    if (cost < bestCost) [best, bestCost] = [lines, cost];
  }
  return best.map((line) => line.join(" "));
}

/** Lay ``title`` out as a lockup: its lines and their sizes. */
export function titleLockup(title: string): TitleLockup {
  const words = title.trim().split(/\s+/);
  const layout = (lines: string[]) => ({ lines, sizes: sizeLines(lines) });

  const one = layout([words.join(" ")]);
  if (words.length === 1 || one.sizes[0] >= ONE_LINE_MIN) return one;

  const two = layout(bestSplit(words, 2));
  if (words.length === 2 || Math.min(...two.sizes) >= TWO_LINE_MIN) return two;

  const three = layout(bestSplit(words, 3));
  return Math.min(...three.sizes) >= Math.min(...two.sizes) * THREE_LINE_GAIN ? three : two;
}
