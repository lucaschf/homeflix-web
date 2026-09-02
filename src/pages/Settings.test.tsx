import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlaybackPreferencesData } from "../api/types";
import "../i18n";
import i18n from "../i18n";
import { DEFAULT_CTA_STYLE, THEME_SCHEMES } from "../theme/colors";
import { themeFor } from "../theme";
import { ThemeModeContext } from "../theme/theme-mode";
import { Settings } from "./Settings";

// The page reaches the backend through ``api``; everything else about
// the preferences path — the query, the camel/snake translation, the
// partial PUT — runs for real.
const { apiGet, apiPut } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
}));

vi.mock("../api/client", () => ({
  AUTH_EXPIRED_EVENT: "homeflix:auth-expired",
  ApiError: class ApiError extends Error {},
  api: {
    get: apiGet,
    post: vi.fn(),
    put: apiPut,
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const SERVER_PREFS: PlaybackPreferencesData = {
  audio_lang: "pt-BR",
  subtitle_lang: "pt-BR",
  subtitle_mode: "foreignOnly",
  default_quality: "best",
  speed: 1,
  subtitle_appearance: {
    color: "#FFFFFF",
    background: "rgba(0, 0, 0, 0.75)",
    font_size: "medium",
    text_edge: "shadow",
  },
  intro_skip_mode: "manual",
  credits_skip_mode: "manual",
};

function stubApi(prefs: Partial<PlaybackPreferencesData> = {}) {
  const data = { ...SERVER_PREFS, ...prefs };
  apiGet.mockImplementation((path: string) => {
    if (path === "/preferences") return Promise.resolve({ data });
    if (path === "/users/me") {
      return Promise.resolve({ data: { id: "usr_1", active_profile_id: "prf_1" } });
    }
    return Promise.resolve({ data: null });
  });
  // ``PUT /preferences`` echoes the full record back.
  apiPut.mockImplementation((_path: string, body: Partial<PlaybackPreferencesData>) =>
    Promise.resolve({ data: { ...data, ...body } }),
  );
}

const setScheme = vi.fn();

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeModeContext.Provider
        value={{
          scheme: THEME_SCHEMES[0],
          setScheme,
          ctaStyle: DEFAULT_CTA_STYLE,
          setCtaStyle: () => {},
        }}
      >
        <ThemeProvider theme={themeFor(THEME_SCHEMES[0], DEFAULT_CTA_STYLE)}>
          <Settings />
        </ThemeProvider>
      </ThemeModeContext.Provider>
    </QueryClientProvider>,
  );
}

/** The segmented control for a setting, addressed by its group label. */
const segment = (label: string) => screen.getByRole("group", { name: label });

/** Pick an option inside a segmented control. */
async function choose(label: string, option: string) {
  await userEvent
    .setup()
    .click(within(segment(label)).getByRole("button", { name: option }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
  stubApi();
});

describe("Settings — playback skip modes", () => {
  it("shows the profile's stored modes", async () => {
    stubApi({ intro_skip_mode: "autoAfterFirst", credits_skip_mode: "auto" });
    renderSettings();

    await waitFor(() =>
      expect(
        within(segment("Opening")).getByRole("button", { name: "From episode 2" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      within(segment("End credits")).getByRole("button", { name: "Play the next one" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("falls back to manual when the backend predates the fields", async () => {
    stubApi({ intro_skip_mode: undefined, credits_skip_mode: undefined });
    renderSettings();

    await waitFor(() =>
      expect(
        within(segment("Opening")).getByRole("button", { name: "Show button" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    expect(
      within(segment("End credits")).getByRole("button", { name: "Next-episode card" }),
    ).toHaveAttribute("aria-pressed", "true");
  });

  it("offers all three opening modes at once", async () => {
    renderSettings();

    const options = within(segment("Opening")).getAllByRole("button");
    expect(options.map((o) => o.textContent)).toEqual([
      "Show button",
      "Skip automatically",
      "From episode 2",
    ]);
  });

  it("sends the opening mode as the API enum, and only that field", async () => {
    renderSettings();

    await choose("Opening", "From episode 2");

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", {
        intro_skip_mode: "autoAfterFirst",
      }),
    );
  });

  it("sends the end-credits mode as the API enum, and only that field", async () => {
    renderSettings();

    await choose("End credits", "Play the next one");

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", {
        credits_skip_mode: "auto",
      }),
    );
  });

  it("labels both controls in pt-BR too", async () => {
    await i18n.changeLanguage("pt-BR");
    renderSettings();

    expect(segment("Abertura")).toBeInTheDocument();
    expect(segment("Créditos finais")).toBeInTheDocument();
    expect(
      within(segment("Abertura")).getByRole("button", { name: "Mostrar botão" }),
    ).toBeInTheDocument();
    expect(
      within(segment("Créditos finais")).getByRole("button", { name: "Card do próximo" }),
    ).toBeInTheDocument();
  });
});

describe("Settings — subtitle appearance", () => {
  it("writes a swatch pick into the appearance object, keeping the rest", async () => {
    renderSettings();

    await userEvent.setup().click(screen.getByRole("button", { name: "Yellow" }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", {
        subtitle_appearance: {
          color: "#FFFF00",
          background: "rgba(0, 0, 0, 0.75)",
          font_size: "medium",
          text_edge: "shadow",
        },
      }),
    );
  });

  it("resets only the appearance back to the defaults", async () => {
    stubApi({
      subtitle_appearance: {
        color: "#00FFFF",
        background: "transparent",
        font_size: "xlarge",
        text_edge: "none",
      },
    });
    renderSettings();

    await waitFor(() =>
      expect(
        within(segment("Font size")).getByRole("button", { name: "Extra Large" }),
      ).toHaveAttribute("aria-pressed", "true"),
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "Reset to default" }));

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", {
        subtitle_appearance: {
          color: "#FFFFFF",
          background: "rgba(0, 0, 0, 0.75)",
          font_size: "medium",
          text_edge: "shadow",
        },
      }),
    );
  });
});

describe("Settings — theme picker", () => {
  it("shows every scheme as a swatch and switches on click", async () => {
    renderSettings();

    const swatches = screen.getAllByRole("button", { pressed: false, hidden: false });
    // Every scheme is visible at once rather than hidden in a dropdown.
    expect(screen.getByRole("button", { name: /HomeFlix/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(swatches.length).toBeGreaterThan(0);

    await userEvent.setup().click(screen.getByRole("button", { name: /Midnight/ }));
    expect(setScheme).toHaveBeenCalledWith("midnight");
  });
});
