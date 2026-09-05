import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "../i18n";
import i18n from "../i18n";
import { theme } from "../theme";
import { HeroBanner, type HeroSlide } from "./HeroBanner";
import { ToastProvider } from "./ToastProvider";

// The banner reaches the backend only through the watchlist hooks; stub
// the client so those queries resolve quietly and the rest runs for real.
vi.mock("../api/client", () => ({
  AUTH_EXPIRED_EVENT: "homeflix:auth-expired",
  ApiError: class ApiError extends Error {},
  api: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    del: vi.fn(),
  },
}));

const BASE_SLIDE: HeroSlide = {
  id: "mov_2xK9mPqR7nL4",
  type: "movie",
  title: "Duna",
  synopsis: "Paul Atreides...",
  year: 2021,
  duration: "2h 35m",
  genres: ["Aventura", "Ficção científica"],
  backdropUrl: null,
  logoUrl: null,
  contentRating: "PG-13",
  trailerUrl: null,
};

function renderHero(slide: HeroSlide) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <HeroBanner slides={[slide]} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const reason = () => screen.queryByTestId("hero-recommendation-reason");

beforeEach(async () => {
  await i18n.changeLanguage("pt-BR");
});

describe("HeroBanner — recommendation reason", () => {
  it("shows the badge for a single matched genre", () => {
    renderHero({ ...BASE_SLIDE, matchedGenres: ["Ficção científica"] });

    expect(reason()).toHaveTextContent("Porque você assiste Ficção científica");
    // The title itself is untouched — the badge is additive.
    expect(screen.getByText("Duna")).toBeInTheDocument();
  });

  it("joins several matched genres with commas and a final conjunction", () => {
    renderHero({
      ...BASE_SLIDE,
      matchedGenres: ["Ficção científica", "Aventura", "Drama"],
    });

    expect(reason()).toHaveTextContent(
      "Porque você assiste Ficção científica, Aventura e Drama",
    );
  });

  it("joins exactly two matched genres with the conjunction only", () => {
    renderHero({ ...BASE_SLIDE, matchedGenres: ["Ficção científica", "Aventura"] });

    expect(reason()).toHaveTextContent("Porque você assiste Ficção científica e Aventura");
  });

  it("renders nothing when the matched list is empty", () => {
    renderHero({ ...BASE_SLIDE, matchedGenres: [] });

    expect(reason()).not.toBeInTheDocument();
    expect(screen.queryByText(/Porque você assiste/)).not.toBeInTheDocument();
  });

  it("renders nothing when the field is absent (older backend)", () => {
    renderHero(BASE_SLIDE);

    expect(reason()).not.toBeInTheDocument();
    expect(screen.getByText("Duna")).toBeInTheDocument();
  });

  it("follows the active language", async () => {
    await i18n.changeLanguage("en");
    renderHero({ ...BASE_SLIDE, matchedGenres: ["Sci-fi", "Adventure"] });

    expect(reason()).toHaveTextContent("Because you watch Sci-fi and Adventure");
  });
});
