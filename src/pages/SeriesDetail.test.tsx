import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { createQueryClient } from "../api/queryClient";
import { ToastProvider } from "../components/ToastProvider";
import i18n from "../i18n";
import { theme } from "../theme";
import { SeriesDetail } from "./SeriesDetail";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

// Only the transport is stubbed: ``ApiError`` stays the real class, so
// the error readers and the app's retry policy see what production sees.
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const SERIES_ID = "ser_7hQ3vNpL2mK8";
const SERIES_PATH = `/series/${SERIES_ID}`;

function renderSeries() {
  // The app's own client, so the test runs under the real retry policy.
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/series/${SERIES_ID}`]}>
            <Routes>
              <Route path="/series/:seriesId" element={<SeriesDetail />} />
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});

describe("SeriesDetail — maturity gate", () => {
  it("shows the restricted copy for an unrated series, without retrying", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path === SERIES_PATH) {
        return Promise.reject(
          new ApiError(403, "Forbidden", {
            message: "This title has no age rating and the profile has a maturity limit",
            code: "CONTENT_RESTRICTED_UNRATED",
            type: "forbidden",
            details: [],
          }),
        );
      }
      // Side queries (related, continue watching, watchlist, /users/me)
      // stay pending; the page must not need them to explain the 403.
      return new Promise(() => {});
    });

    renderSeries();

    expect(await screen.findByText("This title isn't available on this profile")).toBeInTheDocument();
    expect(
      screen.getByText(
        "It doesn't have an age rating yet, so it stays hidden from profiles with an age limit.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this title")).not.toBeInTheDocument();
    // Nothing about the title leaks into the page.
    expect(document.body).not.toHaveTextContent(SERIES_ID);
    expect(apiGet.mock.calls.filter(([path]) => path === SERIES_PATH)).toHaveLength(1);
  });
});
