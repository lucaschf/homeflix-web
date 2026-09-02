import { describe, expect, it } from "vitest";
import { creditsOnsetAction, playbackEndedAction } from "./creditsSkip";

const EPISODE = { isMovie: false, hasNextEpisode: true };
const LAST_EPISODE = { isMovie: false, hasNextEpisode: false };
const MOVIE = { isMovie: true, hasNextEpisode: false };

describe("creditsOnsetAction", () => {
  it("rolls into the next episode on auto", () => {
    expect(creditsOnsetAction({ ...EPISODE, mode: "auto" })).toBe("autoAdvance");
  });

  it("waits for the click on manual", () => {
    expect(creditsOnsetAction({ ...EPISODE, mode: "manual" })).toBe("prompt");
  });

  it("never advances past the last episode, whatever the mode", () => {
    expect(creditsOnsetAction({ ...LAST_EPISODE, mode: "auto" })).toBe("postPlay");
    expect(creditsOnsetAction({ ...LAST_EPISODE, mode: "manual" })).toBe("postPlay");
  });

  it("collapses both modes onto the post-play panel for a movie", () => {
    expect(creditsOnsetAction({ ...MOVIE, mode: "auto" })).toBe("postPlay");
    expect(creditsOnsetAction({ ...MOVIE, mode: "manual" })).toBe("postPlay");
  });
});

describe("playbackEndedAction", () => {
  it("keeps the end-of-file auto-advance on an episode with no marker", () => {
    // Nothing about an unmarked episode may change with the setting:
    // the preference never had an onset to act on.
    expect(
      playbackEndedAction({ ...EPISODE, mode: "manual", hasCreditsMarker: false }),
    ).toBe("autoAdvance");
    expect(
      playbackEndedAction({ ...EPISODE, mode: "auto", hasCreditsMarker: false }),
    ).toBe("autoAdvance");
  });

  it("holds at the prompt on manual once the episode is marked", () => {
    expect(
      playbackEndedAction({ ...EPISODE, mode: "manual", hasCreditsMarker: true }),
    ).toBe("prompt");
  });

  it("advances on auto", () => {
    expect(
      playbackEndedAction({ ...EPISODE, mode: "auto", hasCreditsMarker: true }),
    ).toBe("autoAdvance");
  });

  it("hands a finished movie or last episode to the post-play panel", () => {
    expect(
      playbackEndedAction({ ...MOVIE, mode: "auto", hasCreditsMarker: true }),
    ).toBe("postPlay");
    expect(
      playbackEndedAction({ ...LAST_EPISODE, mode: "manual", hasCreditsMarker: false }),
    ).toBe("postPlay");
  });
});
