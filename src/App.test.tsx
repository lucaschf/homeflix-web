import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import i18n from "./i18n";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("./api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./api/client")>()),
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

// The flag is a build-time constant; the challenge only opens with it on.
vi.mock("./config/featureFlags", () => ({
  SHARE_ENABLED: true,
  PARENTAL_CONTROLS_ENABLED: true,
}));

beforeEach(async () => {
  vi.clearAllMocks();
  // Skip the boot splash: only the provider tree matters here.
  window.sessionStorage.setItem("homeflix:splash-shown", "1");
  await i18n.changeLanguage("en");
  // The session never resolves, so the routes stay on their loading state.
  apiGet.mockImplementation(() => new Promise(() => {}));
  apiPost.mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("App composition", () => {
  it("mounts the parental PIN challenge for writes refused with PARENTAL_PIN_REQUIRED", async () => {
    render(<App />);
    expect(screen.queryByRole("dialog", { name: "Parental PIN required" })).not.toBeInTheDocument();

    // An unguarded admin write the backend refuses, sent through the real
    // client: the challenge it opens is the one ``App`` mounts.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ code: "PARENTAL_PIN_REQUIRED", type: "forbidden", message: "", details: [] }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const { api: realApi } = await vi.importActual<typeof import("./api/client")>("./api/client");
    act(() => {
      void realApi.post("/admin/scans", { library_id: "lib_movies" }).catch(() => {});
    });

    const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
    expect(dialog).toHaveTextContent("Enter the 6-digit parental PIN to continue.");
  });
});
