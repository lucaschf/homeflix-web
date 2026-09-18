import type { CSSProperties } from "react";

/**
 * Display shapes the player can force on the picture, in the order the
 * cycle shortcut walks them.
 *
 * ``auto`` is the browser's own behaviour: the frame is letterboxed at
 * whatever ratio the file declares. The explicit ratios are here because
 * that declaration is sometimes wrong — broadcast rips in particular
 * arrive as 4:3 content flagged 16:9, which plays back horizontally
 * stretched with nothing in the stream to say so. Forcing the ratio
 * squeezes the frame back into the shape it was shot in, the same
 * correction VLC's Video ▸ Aspect Ratio makes.
 *
 * ``stretch`` and ``zoom`` cover the other two things a viewer reaches
 * for: fill the screen ignoring the shape, and fill it by cropping (how
 * a TV's "zoom" eats letterbox bars baked into the picture).
 */
export const ASPECT_MODES = [
  "auto",
  "16:9",
  "4:3",
  "16:10",
  "2.35:1",
  "1:1",
  "stretch",
  "zoom",
] as const;

export type AspectMode = (typeof ASPECT_MODES)[number];

/**
 * Modes whose label is a word rather than the ratio itself. The ratio
 * modes are named by their own value ("16:9"), which needs no
 * translation — hence a partial map, and a lookup that falls back to
 * the mode string.
 */
export const ASPECT_LABEL_KEYS: Readonly<Partial<Record<AspectMode, string>>> =
  Object.freeze({
    auto: "player.aspect.auto",
    stretch: "player.aspect.stretch",
    zoom: "player.aspect.zoom",
  });

/** Width ÷ height the mode forces, or ``null`` when it forces nothing. */
export function forcedAspectRatio(mode: AspectMode): number | null {
  if (mode === "auto" || mode === "stretch" || mode === "zoom") return null;
  // The label *is* the ratio, so it doubles as the parse input.
  const [width, height] = mode.split(":").map(Number);
  return width / height;
}

/** The next shape in the cycle; wraps back to ``auto`` at the end. */
export function nextAspectMode(mode: AspectMode): AspectMode {
  const index = ASPECT_MODES.indexOf(mode);
  return ASPECT_MODES[(index + 1) % ASPECT_MODES.length];
}

/** Measured player stage, in CSS pixels. */
export interface StageSize {
  width: number;
  height: number;
}

/**
 * Inline style for the ``<video>`` element under a given shape.
 *
 * The three unforced modes are plain ``object-fit`` and ignore
 * ``stage``. A forced ratio has to be laid out by hand: the picture
 * gets the largest box of that ratio which still fits the stage, and
 * ``object-fit: fill`` squeezes the decoded frame into it — the whole
 * frame stays visible, at the shape asked for.
 *
 * CSS cannot express that fit on its own. ``aspect-ratio`` plus
 * ``max-width``/``max-height`` looks like it should, but a clamp on one
 * axis does not re-derive the other, so the box overflows the stage
 * whenever the stage is the narrower shape (verified in Chromium) —
 * hence the measured stage and the ``Math.min`` below.
 *
 * Until the stage has been measured there is nothing to fit against, so
 * a forced ratio renders as ``auto`` for that first frame rather than
 * guessing.
 */
export function videoFitStyle(
  mode: AspectMode,
  stage: StageSize | null,
): CSSProperties {
  const ratio = forcedAspectRatio(mode);

  if (ratio === null || !stage || stage.width <= 0 || stage.height <= 0) {
    return {
      width: "100%",
      height: "100%",
      objectFit:
        mode === "stretch" ? "fill" : mode === "zoom" ? "cover" : "contain",
    };
  }

  return {
    width: Math.min(stage.width, stage.height * ratio),
    height: Math.min(stage.height, stage.width / ratio),
    objectFit: "fill",
  };
}
