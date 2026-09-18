import { describe, expect, it } from "vitest";
import {
  ASPECT_MODES,
  forcedAspectRatio,
  nextAspectMode,
  videoFitStyle,
  type AspectMode,
} from "./aspectRatio";

const STAGE = { width: 1920, height: 1080 };

describe("forcedAspectRatio", () => {
  it("forces nothing for the object-fit modes", () => {
    expect(forcedAspectRatio("auto")).toBeNull();
    expect(forcedAspectRatio("stretch")).toBeNull();
    expect(forcedAspectRatio("zoom")).toBeNull();
  });

  it("reads the ratio out of the mode's own label", () => {
    expect(forcedAspectRatio("16:9")).toBeCloseTo(16 / 9);
    expect(forcedAspectRatio("4:3")).toBeCloseTo(4 / 3);
    expect(forcedAspectRatio("16:10")).toBeCloseTo(1.6);
    expect(forcedAspectRatio("2.35:1")).toBeCloseTo(2.35);
    expect(forcedAspectRatio("1:1")).toBe(1);
  });
});

describe("nextAspectMode", () => {
  it("walks every mode and comes back to the start", () => {
    const seen: AspectMode[] = [];
    let mode: AspectMode = "auto";
    for (let i = 0; i < ASPECT_MODES.length; i += 1) {
      seen.push(mode);
      mode = nextAspectMode(mode);
    }
    expect(seen).toEqual([...ASPECT_MODES]);
    expect(mode).toBe("auto");
  });
});

describe("videoFitStyle", () => {
  it("leaves the file's own shape alone on auto", () => {
    expect(videoFitStyle("auto", STAGE)).toEqual({
      width: "100%",
      height: "100%",
      objectFit: "contain",
    });
  });

  it("fills the stage on stretch and crops to it on zoom", () => {
    expect(videoFitStyle("stretch", STAGE)).toMatchObject({ objectFit: "fill", width: "100%" });
    expect(videoFitStyle("zoom", STAGE)).toMatchObject({ objectFit: "cover", width: "100%" });
  });

  it("squeezes a 16:9 stage down to a 4:3 picture", () => {
    // The stretched-broadcast case: the whole frame stays on screen,
    // reshaped to 4:3 — full height, narrower than the stage.
    expect(videoFitStyle("4:3", STAGE)).toEqual({
      width: 1440,
      height: 1080,
      objectFit: "fill",
    });
  });

  it("binds on width when the stage is the narrower shape", () => {
    // Phone held upright: the ratio box has to shrink vertically, which
    // is the case a pure-CSS aspect-ratio clamp gets wrong.
    expect(videoFitStyle("4:3", { width: 400, height: 900 })).toEqual({
      width: 400,
      height: 300,
      objectFit: "fill",
    });
  });

  it("never lets a forced ratio overflow the stage", () => {
    const stages = [
      { width: 1920, height: 1080 },
      { width: 800, height: 600 },
      { width: 1000, height: 400 },
      { width: 400, height: 900 },
    ];
    for (const stage of stages) {
      for (const mode of ASPECT_MODES) {
        const ratio = forcedAspectRatio(mode);
        if (ratio === null) continue;
        const { width, height } = videoFitStyle(mode, stage) as {
          width: number;
          height: number;
        };
        expect(width).toBeLessThanOrEqual(stage.width);
        expect(height).toBeLessThanOrEqual(stage.height);
        expect(width / height).toBeCloseTo(ratio);
      }
    }
  });

  it("falls back to the file's shape until the stage is measured", () => {
    // One frame of "not yet corrected" beats one frame of a guessed box.
    expect(videoFitStyle("4:3", null)).toMatchObject({ objectFit: "contain" });
    expect(videoFitStyle("4:3", { width: 0, height: 0 })).toMatchObject({
      objectFit: "contain",
    });
  });
});
