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
import { MovieDetail } from "./MovieDetail";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

// Only the transport is stubbed: ``ApiError`` stays the real class, so
// the error readers and the app's retry policy see what production sees.
vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const MOVIE_ID = "mov_2xK9mPqR7nL4";
const MOVIE_PATH = `/movies/${MOVIE_ID}`;

function renderMovie() {
  // The app's own client, so the test runs under the real retry policy.
  const client = createQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/movie/${MOVIE_ID}`]}>
            <Routes>
              <Route path="/movie/:movieId" element={<MovieDetail />} />
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

describe("MovieDetail — maturity gate", () => {
  it("shows the restricted copy for a title above the profile's limit, without retrying", async () => {
    apiGet.mockImplementation((path: string) => {
      if (path === MOVIE_PATH) {
        return Promise.reject(
          new ApiError(403, "Forbidden", {
            message: "This title is above the profile's maturity limit",
            code: "CONTENT_RESTRICTED_BY_MATURITY",
            type: "forbidden",
            details: [
              {
                code: "CONTENT_RESTRICTED_BY_MATURITY",
                message: "Requires age 16; profile limit is 12",
                metadata: { required_age: 16, profile_limit: 12 },
              },
            ],
          }),
        );
      }
      // Side queries (related, progress, watchlist, /users/me) stay
      // pending; the page must not need them to explain the 403.
      return new Promise(() => {});
    });

    renderMovie();

    expect(await screen.findByText("This title isn't available on this profile")).toBeInTheDocument();
    expect(
      screen.getByText("Its age rating is above the limit set for this profile."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Couldn't load this title")).not.toBeInTheDocument();
    // Nothing about the title leaks into the page.
    expect(document.body).not.toHaveTextContent(MOVIE_ID);
    expect(apiGet.mock.calls.filter(([path]) => path === MOVIE_PATH)).toHaveLength(1);
  });
});
