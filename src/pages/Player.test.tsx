import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import Hls from "hls.js";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { createQueryClient } from "../api/queryClient";
import i18n from "../i18n";
import { theme } from "../theme";
import { Player } from "./Player";

const { apiGet, hlsInstances } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  hlsInstances: [] as FakeHlsInstance[],
}));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

interface FakeHlsInstance {
  loadSource: ReturnType<typeof vi.fn>;
  startLoad: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  emit: (event: string, data: unknown) => void;
}

// jsdom has no MediaSource, so hls.js itself cannot run. The fake keeps
// the real enums and records the handlers the player registers, so a
// test can raise the error hls.js would raise.
vi.mock("hls.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("hls.js")>();
  const Real = actual.default;
  class FakeHls {
    static Events = Real.Events;
    static ErrorTypes = Real.ErrorTypes;
    static ErrorDetails = Real.ErrorDetails;
    static isSupported = () => true;
    subtitleDisplay = true;
    audioTracks = [];
    subtitleTracks = [];
    levels = [];
    loadSource = vi.fn();
    attachMedia = vi.fn();
    startLoad = vi.fn();
    stopLoad = vi.fn();
    destroy = vi.fn();
    recoverMediaError = vi.fn();
    private handlers = new Map<string, ((event: string, data: unknown) => void)[]>();
    constructor() {
      hlsInstances.push(this);
    }
    on(event: string, handler: (event: string, data: unknown) => void) {
      this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    }
    off() {}
    emit(event: string, data: unknown) {
      for (const handler of this.handlers.get(event) ?? []) handler(event, data);
    }
  }
  return { ...actual, default: FakeHls };
});

const MOVIE_ID = "mov_2xK9mPqR7nL4";
const MANIFEST_URL = `/api/v1/stream/movie/${MOVIE_ID}/hls/playlist.m3u8`;

const MOVIE = {
  id: MOVIE_ID,
  title: "Duna",
  original_title: null,
  year: 2021,
  duration_seconds: 9300,
  duration_formatted: "2h 35m",
  synopsis: null,
  tagline: null,
  poster_path: null,
  backdrop_path: null,
  logo_path: null,
  genres: [],
  cast: [],
  directors: [],
  writers: [],
  content_rating: null,
  trailer_url: null,
  collection: null,
  file_path: null,
  file_size: null,
  resolution: null,
  files: [],
  tmdb_id: null,
  imdb_id: null,
  needs_enrichment_review: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
  credits: null,
};

function renderPlayer(client = createQueryClient()) {
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={[`/play/movie/${MOVIE_ID}`]}>
          <Routes>
            <Route path="/play/movie/:movieId" element={<Player />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  hlsInstances.length = 0;
  await i18n.changeLanguage("en");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Metadata and saved progress resolve, so the player mounts hls.js. */
async function mountStream() {
  apiGet.mockImplementation((path: string) => {
    if (path === `/movies/${MOVIE_ID}`) return Promise.resolve({ data: MOVIE });
    if (path === `/progress/${MOVIE_ID}`) return Promise.resolve({ data: null });
    return new Promise(() => {});
  });
  renderPlayer();
  await waitFor(() => expect(hlsInstances).toHaveLength(1));
  const hls = hlsInstances[0]!;
  expect(hls.loadSource).toHaveBeenCalledWith(MANIFEST_URL);
  return hls;
}

/** Raise a fatal network error and let the 3s reload timer run out. */
function failNetwork(hls: FakeHlsInstance, details: string, code: number) {
  vi.useFakeTimers();
  act(() => {
    hls.emit(Hls.Events.ERROR, {
      type: Hls.ErrorTypes.NETWORK_ERROR,
      details,
      fatal: true,
      response: { url: MANIFEST_URL, code, text: "" },
    });
  });
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
}

describe("Player — refused stream", () => {
  it.each([403, 404])("stops reloading a manifest answered with %i", async (code) => {
    const hls = await mountStream();

    failNetwork(hls, Hls.ErrorDetails.MANIFEST_LOAD_ERROR, code);

    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(hls.destroy).toHaveBeenCalled();
    expect(screen.getByText("Couldn't load this title")).toBeInTheDocument();
  });

  it("keeps reloading a manifest that failed with a 5xx", async () => {
    const hls = await mountStream();

    failNetwork(hls, Hls.ErrorDetails.MANIFEST_LOAD_ERROR, 502);

    expect(hls.startLoad).toHaveBeenCalled();
    expect(screen.queryByText("Couldn't load this title")).not.toBeInTheDocument();
  });

  it("keeps reloading after a segment 404 from the cache route", async () => {
    const hls = await mountStream();

    failNetwork(hls, Hls.ErrorDetails.FRAG_LOAD_ERROR, 404);

    expect(hls.startLoad).toHaveBeenCalled();
    expect(screen.queryByText("Couldn't load this title")).not.toBeInTheDocument();
  });
});

/**
 * Mounts far enough for the keyboard handler to be live: metadata is
 * already cached, so the <video> is in the DOM on the first render
 * instead of behind the loading overlay.
 */
async function mountPlaying() {
  const client = createQueryClient();
  client.setQueryData(["movie", MOVIE_ID, "en"], MOVIE);
  // jsdom's track list is a bare array; the subtitle effect binds to it.
  vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue(
    Object.assign(new EventTarget(), { length: 0 }) as unknown as TextTrackList,
  );
  apiGet.mockImplementation((path: string) => {
    if (path === `/movies/${MOVIE_ID}`) return Promise.resolve({ data: MOVIE });
    if (path === `/progress/${MOVIE_ID}`) return Promise.resolve({ data: null });
    return new Promise(() => {});
  });
  renderPlayer(client);
  await waitFor(() => expect(hlsInstances).toHaveLength(1));
}

function press(key: string, modifiers: KeyboardEventInit = {}) {
  act(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key, ...modifiers }));
  });
}

describe("Player — overlay menu shortcuts", () => {
  it("opens the picture-shape list on `c`", async () => {
    await mountPlaying();

    press("c");

    expect(screen.getByText("Original")).toBeInTheDocument();
    expect(screen.getByText("4:3")).toBeInTheDocument();
  });

  it("closes it again on a second `c`", async () => {
    await mountPlaying();

    press("c");
    press("c");

    await waitFor(() => expect(screen.queryByText("4:3")).not.toBeInTheDocument());
  });

  it("never stacks two overlay menus", async () => {
    // Opening the audio menu has to take the picture-shape menu down
    // with it, or the viewer is left peeling modals apart one Escape
    // at a time with only the top one answering the mouse.
    await mountPlaying();

    press("c");
    expect(screen.getByText("4:3")).toBeInTheDocument();

    press("t");
    await waitFor(() => expect(screen.queryByText("4:3")).not.toBeInTheDocument());
  });

  it("leaves browser and OS shortcuts alone", async () => {
    // Ctrl+C copies. It must not also open a menu behind the copy —
    // every player binding is a bare key.
    await mountPlaying();

    press("c", { ctrlKey: true });
    press("c", { metaKey: true });

    expect(screen.queryByText("4:3")).not.toBeInTheDocument();
  });
});

describe("Player — metadata failures", () => {
  it("explains a restricted title instead of spinning", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path === `/movies/${MOVIE_ID}`) {
        return Promise.reject(
          new ApiError(403, "Forbidden", { code: "CONTENT_RESTRICTED_UNRATED", details: [] }),
        );
      }
      return new Promise(() => {});
    });

    renderPlayer();

    expect(await screen.findByText("This title isn't available on this profile")).toBeInTheDocument();
    expect(
      screen.getByText(
        "It doesn't have an age rating yet, so it stays hidden from profiles with an age limit.",
      ),
    ).toBeInTheDocument();
    expect(apiGet.mock.calls.filter(([path]) => path === `/movies/${MOVIE_ID}`)).toHaveLength(1);
  });

  it("explains a restricted title whose metadata was cached when the manifest is refused", async () => {
    // Metadata from an earlier visit: the refetch on mount fails with the
    // gate's 403 but the query keeps the cached movie, so playback starts.
    const client = createQueryClient();
    client.setQueryData(["movie", MOVIE_ID, "en"], MOVIE);
    // With metadata cached the <video> mounts on the first render, so the
    // subtitle effect binds to its tracks; jsdom's list is a bare array.
    vi.spyOn(HTMLMediaElement.prototype, "textTracks", "get").mockReturnValue(
      Object.assign(new EventTarget(), { length: 0 }) as unknown as TextTrackList,
    );
    apiGet.mockImplementation((path: string) => {
      if (path === `/movies/${MOVIE_ID}`) {
        return Promise.reject(
          new ApiError(403, "Forbidden", { code: "CONTENT_RESTRICTED_BY_MATURITY", details: [] }),
        );
      }
      if (path === `/progress/${MOVIE_ID}`) return Promise.resolve({ data: null });
      return new Promise(() => {});
    });

    renderPlayer(client);
    await waitFor(() => {
      const state = client.getQueryState(["movie", MOVIE_ID, "en"]);
      expect(state?.status).toBe("error");
      expect(state?.data).toEqual(MOVIE);
    });
    await waitFor(() => expect(hlsInstances).toHaveLength(1));
    const hls = hlsInstances[0]!;

    failNetwork(hls, Hls.ErrorDetails.MANIFEST_LOAD_ERROR, 403);

    expect(hls.startLoad).not.toHaveBeenCalled();
    expect(screen.getByText("This title isn't available on this profile")).toBeInTheDocument();
    expect(
      screen.getByText("Its age rating is above the limit set for this profile."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this title")).not.toBeInTheDocument();
  });
});
