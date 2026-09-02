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

function renderSettings() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeModeContext.Provider
        value={{
          scheme: THEME_SCHEMES[0],
          setScheme: () => {},
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

/** Open a MUI select by its label and click one of its options. */
async function choose(label: string, option: string) {
  const user = userEvent.setup();
  await user.click(screen.getByLabelText(label));
  const listbox = await screen.findByRole("listbox");
  await user.click(within(listbox).getByRole("option", { name: option }));
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

    expect(await screen.findByText("Skip from the 2nd episode on")).toBeInTheDocument();
    expect(screen.getByText("Start the next episode")).toBeInTheDocument();
  });

  it("falls back to manual when the backend predates the fields", async () => {
    stubApi({ intro_skip_mode: undefined, credits_skip_mode: undefined });
    renderSettings();

    expect(await screen.findByText("Show the Skip Intro button")).toBeInTheDocument();
    expect(screen.getByText("Show the next-episode card")).toBeInTheDocument();
  });

  it("offers all three opening modes", async () => {
    renderSettings();
    await screen.findByText("Show the Skip Intro button");

    await userEvent.setup().click(screen.getByLabelText("Opening"));
    const options = within(await screen.findByRole("listbox")).getAllByRole("option");
    expect(options.map((o) => o.textContent)).toEqual([
      "Show the Skip Intro button",
      "Skip automatically",
      "Skip from the 2nd episode on",
    ]);
  });

  it("sends the opening mode as the API enum, and only that field", async () => {
    renderSettings();
    await screen.findByText("Show the Skip Intro button");

    await choose("Opening", "Skip from the 2nd episode on");

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", {
        intro_skip_mode: "autoAfterFirst",
      }),
    );
  });

  it("sends the end-credits mode as the API enum, and only that field", async () => {
    renderSettings();
    await screen.findByText("Show the next-episode card");

    await choose("End credits", "Start the next episode");

    await waitFor(() =>
      expect(apiPut).toHaveBeenCalledWith("/preferences", {
        credits_skip_mode: "auto",
      }),
    );
  });

  it("labels both controls in pt-BR too", async () => {
    await i18n.changeLanguage("pt-BR");
    renderSettings();

    expect(await screen.findByLabelText("Abertura")).toBeInTheDocument();
    expect(screen.getByLabelText("Créditos finais")).toBeInTheDocument();
    expect(screen.getByText("Mostrar o botão Pular abertura")).toBeInTheDocument();
    expect(screen.getByText("Mostrar o card do próximo episódio")).toBeInTheDocument();
  });
});
