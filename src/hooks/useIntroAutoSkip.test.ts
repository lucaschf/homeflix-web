import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IntroWindow } from "../utils/introSkip";
import type { IntroSkipMode } from "./usePlaybackPreferences";
import { useIntroAutoSkip } from "./useIntroAutoSkip";

const INTRO: IntroWindow = { start_seconds: 12, end_seconds: 102 };

const onSkip = vi.fn();

interface Props {
  position: number;
  mode?: IntroSkipMode;
  episodeNumber?: number;
  active?: boolean;
  playbackKey?: string;
  intro?: IntroWindow | null;
}

/**
 * Mount the hook the way the player does — a fresh playhead sample on
 * every render — and hand back the rerender so a test can walk the
 * playhead forward.
 */
function mount(initial: Props) {
  return renderHook(
    (props: Props) =>
      useIntroAutoSkip({
        intro: props.intro === undefined ? INTRO : props.intro,
        mode: props.mode ?? "auto",
        episodeNumber: props.episodeNumber ?? 1,
        position: props.position,
        active: props.active ?? true,
        playbackKey: props.playbackKey ?? "episode:1",
        onSkip,
      }),
    { initialProps: initial },
  );
}

beforeEach(() => {
  onSkip.mockClear();
});

describe("useIntroAutoSkip", () => {
  it("skips once when playback walks into the opening", () => {
    const { rerender } = mount({ position: 0 });
    expect(onSkip).not.toHaveBeenCalled();

    rerender({ position: 13 });
    expect(onSkip).toHaveBeenCalledExactlyOnceWith(102);

    // Back into the window (the viewer went to look): no second skip.
    rerender({ position: 20 });
    expect(onSkip).toHaveBeenCalledOnce();
  });

  it("stays put while the mode is manual", () => {
    const { rerender } = mount({ position: 0, mode: "manual" });
    rerender({ position: 13, mode: "manual" });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("waits for the stream on autoAfterFirst episode 1, skips on episode 2", () => {
    const first = mount({ position: 0, mode: "autoAfterFirst", episodeNumber: 1 });
    first.rerender({ position: 13, mode: "autoAfterFirst", episodeNumber: 1 });
    expect(onSkip).not.toHaveBeenCalled();
    first.unmount();

    const second = mount({
      position: 0,
      mode: "autoAfterFirst",
      episodeNumber: 2,
      playbackKey: "episode:2",
    });
    second.rerender({
      position: 13,
      mode: "autoAfterFirst",
      episodeNumber: 2,
      playbackKey: "episode:2",
    });
    expect(onSkip).toHaveBeenCalledExactlyOnceWith(102);
  });

  it("does not skip before the stream is playing", () => {
    const { rerender } = mount({ position: 13, active: false });
    expect(onSkip).not.toHaveBeenCalled();
    rerender({ position: 13, active: true });
    expect(onSkip).toHaveBeenCalledExactlyOnceWith(102);
  });

  it("leaves an episode without a marker alone", () => {
    const { rerender } = mount({ position: 0, intro: null });
    rerender({ position: 13, intro: null });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("does not skip an opening the viewer seeked into", () => {
    const { result, rerender } = mount({ position: 0 });
    act(() => result.current.notifySeek(30));
    rerender({ position: 30 });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("skips on the resume that drops the viewer mid-opening", () => {
    // No seek notification: the position simply *is* 30 on the first
    // sample, because that is where watching left off.
    mount({ position: 30 });
    expect(onSkip).toHaveBeenCalledExactlyOnceWith(102);
  });

  it("gives the next episode its own skip", () => {
    const { rerender } = mount({ position: 13 });
    expect(onSkip).toHaveBeenCalledOnce();

    rerender({ position: 0, playbackKey: "episode:2" });
    rerender({ position: 13, playbackKey: "episode:2" });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });

  it("stands down for the rest of the playback once the skip is spent", () => {
    const { result, rerender } = mount({ position: 0, playbackKey: "episode:1" });
    // The viewer pressed Skip Intro themselves.
    act(() => result.current.notifyConsumed());
    rerender({ position: 13 });
    expect(onSkip).not.toHaveBeenCalled();
  });

  it("hands a replay a fresh skip", () => {
    const { result, rerender } = mount({ position: 13 });
    expect(onSkip).toHaveBeenCalledOnce();

    act(() => result.current.reset());
    rerender({ position: 5 });
    rerender({ position: 13 });
    expect(onSkip).toHaveBeenCalledTimes(2);
  });
});
