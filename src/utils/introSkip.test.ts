import { describe, expect, it } from "vitest";
import {
  autoSkipsIntro,
  createIntroSkipState,
  isInsideIntro,
  markIntroSkipConsumed,
  observePosition,
  observeSeek,
  type IntroSkipState,
  type IntroWindow,
} from "./introSkip";

/** The shape the backend sends: opening from 0:12 to 1:42. */
const INTRO: IntroWindow = { start_seconds: 12, end_seconds: 102 };

/**
 * Play the episode forward through a list of positions, the way
 * ``timeupdate`` would, and collect every seek the machine asks for.
 */
function play(
  positions: number[],
  {
    intro = INTRO,
    autoEnabled = true,
    state = createIntroSkipState(),
  }: {
    intro?: IntroWindow | null;
    autoEnabled?: boolean;
    state?: IntroSkipState;
  } = {},
): { skips: number[]; state: IntroSkipState } {
  const skips: number[] = [];
  let current = state;
  for (const position of positions) {
    const sample = observePosition(current, position, intro, autoEnabled);
    current = sample.state;
    if (sample.skipTo !== null) skips.push(sample.skipTo);
  }
  return { skips, state: current };
}

describe("autoSkipsIntro", () => {
  it("never skips on manual, whatever the episode", () => {
    expect(autoSkipsIntro("manual", 1)).toBe(false);
    expect(autoSkipsIntro("manual", 7)).toBe(false);
  });

  it("always skips on auto", () => {
    expect(autoSkipsIntro("auto", 1)).toBe(true);
    expect(autoSkipsIntro("auto", 7)).toBe(true);
  });

  it("plays the opening on episode 1 and skips it from episode 2 on", () => {
    expect(autoSkipsIntro("autoAfterFirst", 1)).toBe(false);
    expect(autoSkipsIntro("autoAfterFirst", 2)).toBe(true);
    expect(autoSkipsIntro("autoAfterFirst", 12)).toBe(true);
  });

  it("treats a season's specials (episode 0) as the first episode", () => {
    expect(autoSkipsIntro("autoAfterFirst", 0)).toBe(false);
  });
});

describe("isInsideIntro", () => {
  it("includes the start second and excludes the end second", () => {
    expect(isInsideIntro(INTRO, 11.9)).toBe(false);
    expect(isInsideIntro(INTRO, 12)).toBe(true);
    expect(isInsideIntro(INTRO, 101.9)).toBe(true);
    expect(isInsideIntro(INTRO, 102)).toBe(false);
  });
});

describe("observePosition", () => {
  it("skips to the end of the window when playback walks into it", () => {
    const { skips } = play([0, 5, 11, 13]);
    expect(skips).toEqual([102]);
  });

  it("leaves the playhead alone while the mode is manual", () => {
    const { skips } = play([0, 13, 40, 90], { autoEnabled: false });
    expect(skips).toEqual([]);
  });

  it("does nothing on an episode without a marker", () => {
    const { skips } = play([0, 13, 40, 90], { intro: null });
    expect(skips).toEqual([]);
  });

  it("skips when a resume drops the viewer inside the opening", () => {
    // Continue watching hands back second 30 of a 12–102 opening: the
    // first sample of the playback is already inside the window.
    const { skips } = play([30]);
    expect(skips).toEqual([102]);
  });

  it("skips once per playback, even if the viewer goes back", () => {
    const first = play([13]);
    expect(first.skips).toEqual([102]);
    // Back to the top of the opening and forward through it again.
    const second = play([20, 40, 60], { state: first.state });
    expect(second.skips).toEqual([]);
  });

  it("skips again once the playback is restarted", () => {
    const { state } = play([13]);
    expect(state.consumed).toBe(true);
    // A new playback (next episode, or a replay) starts from scratch.
    expect(play([13], { state: createIntroSkipState() }).skips).toEqual([102]);
  });
});

describe("observeSeek", () => {
  it("never skips an opening the viewer dragged the playhead into", () => {
    let state = createIntroSkipState();
    state = observeSeek(state, 30, INTRO);
    const { skips, state: after } = play([30, 45, 70], { state });
    expect(skips).toEqual([]);
    expect(after.consumed).toBe(false);
  });

  it("still skips when the seek lands before the opening", () => {
    // Rewinding to the recap is not a request to watch the theme.
    let state = createIntroSkipState();
    state = observeSeek(state, 5, INTRO);
    expect(play([5, 8, 13], { state }).skips).toEqual([102]);
  });

  it("re-arms once the playhead leaves the window it was dropped into", () => {
    let state = createIntroSkipState();
    state = observeSeek(state, 30, INTRO);
    // Watched the rest of the opening, then went back to the recap and
    // let it play into the opening a second time.
    const watched = play([30, 60, 101, 110], { state });
    expect(watched.skips).toEqual([]);
    expect(watched.state.suppressed).toBe(false);
    state = observeSeek(watched.state, 5, INTRO);
    expect(play([5, 13], { state }).skips).toEqual([102]);
  });

  it("ignores seeks on an episode with no marker", () => {
    const state = observeSeek(createIntroSkipState(), 30, null);
    expect(state.suppressed).toBe(false);
  });
});

describe("markIntroSkipConsumed", () => {
  it("spends the playback's skip without moving the playhead", () => {
    // The Skip Intro button and the "watch it after all" offer both
    // report back this way.
    const state = markIntroSkipConsumed(createIntroSkipState());
    expect(state.consumed).toBe(true);
    expect(play([13], { state }).skips).toEqual([]);
  });
});
