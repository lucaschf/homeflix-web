import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useAspectRatio } from "./useAspectRatio";

const SERIES = "ser_7hK2pQ";
const OTHER = "mov_3nB8xW";
const KEY = `homeflix-aspect-ratio:${SERIES}`;

describe("useAspectRatio", () => {
  it("leaves the picture alone by default", () => {
    const { result } = renderHook(() => useAspectRatio(SERIES));
    expect(result.current.mode).toBe("auto");
  });

  it("remembers the correction for the next episode of the same title", () => {
    const first = renderHook(() => useAspectRatio(SERIES));
    act(() => first.result.current.setMode("4:3"));
    expect(first.result.current.mode).toBe("4:3");

    // A later episode mounts the player again with the same series id.
    const later = renderHook(() => useAspectRatio(SERIES));
    expect(later.result.current.mode).toBe("4:3");
  });

  it("keeps one title's correction off every other title", () => {
    const { result } = renderHook(() => useAspectRatio(SERIES));
    act(() => result.current.setMode("4:3"));

    expect(renderHook(() => useAspectRatio(OTHER)).result.current.mode).toBe("auto");
  });

  it("re-reads the store when the player navigates to another title", () => {
    localStorage.setItem(KEY, "16:10");
    const { result, rerender } = renderHook(({ id }) => useAspectRatio(id), {
      initialProps: { id: OTHER },
    });
    expect(result.current.mode).toBe("auto");

    rerender({ id: SERIES });
    expect(result.current.mode).toBe("16:10");
  });

  it("stores the default as the absence of a row", () => {
    const { result } = renderHook(() => useAspectRatio(SERIES));
    act(() => result.current.setMode("zoom"));
    expect(localStorage.getItem(KEY)).toBe("zoom");

    act(() => result.current.setMode("auto"));
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("cycles to the next shape and reports the one now showing", () => {
    const { result } = renderHook(() => useAspectRatio(SERIES));
    let applied: string | undefined;
    act(() => {
      applied = result.current.cycle();
    });
    expect(applied).toBe("16:9");
    expect(result.current.mode).toBe("16:9");
  });

  it("ignores a stored value this build doesn't know", () => {
    localStorage.setItem(KEY, "21:9");
    const { result } = renderHook(() => useAspectRatio(SERIES));
    expect(result.current.mode).toBe("auto");
  });

  it("stays quiet when there is no title to key on", () => {
    const { result } = renderHook(() => useAspectRatio(""));
    act(() => result.current.setMode("4:3"));
    expect(result.current.mode).toBe("4:3");
    expect(localStorage.length).toBe(0);
  });
});
