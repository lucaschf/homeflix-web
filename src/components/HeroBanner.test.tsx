import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { theme } from "../theme";
import { HeroBanner, type HeroSlide } from "./HeroBanner";
import { ToastProvider } from "./ToastProvider";
import { artworkSrcSet } from "../utils/artwork";

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

function renderSlides(slides: HeroSlide[]) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <HeroBanner slides={slides} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("HeroBanner — backdrops", () => {
  const backdrop = (n: number) => `https://image.tmdb.org/t/p/original/bd${n}.jpg`;
  // ``src`` is the largest ladder variant, not the URL the slide carries.
  const backdropSrc = (n: number) => artworkSrcSet(backdrop(n), "backdrop").src;
  const slidesWithBackdrops = (n: number): HeroSlide[] =>
    Array.from({ length: n }, (_, i) => ({
      ...BASE_SLIDE,
      id: `mov_${i}`,
      title: `Title ${i}`,
      backdropUrl: backdrop(i),
    }));

  // Every backdrop is a multi-hundred-KB "original" download on the
  // API host; mounting all of them at once starves the visible one.
  it("only mounts the current slide and its neighbours", () => {
    renderSlides(slidesWithBackdrops(6));

    const srcs = Array.from(document.querySelectorAll("img")).map((img) => img.getAttribute("src"));
    expect(srcs).toEqual([backdropSrc(0), backdropSrc(1), backdropSrc(5)]);
  });

  it("keeps a single slide's backdrop mounted", () => {
    renderSlides(slidesWithBackdrops(1));

    expect(document.querySelectorAll("img")).toHaveLength(1);
  });

  it("reveals the current backdrop only after its image has loaded", () => {
    renderSlides(slidesWithBackdrops(3));
    const [first] = screen.getAllByTestId("hero-backdrop");
    expect(first).toHaveAttribute("data-visible", "false");

    fireEvent.load(document.querySelector(`img[src="${backdropSrc(0)}"]`)!);

    expect(first).toHaveAttribute("data-visible", "true");
    // Neighbours stay hidden even once fetched — only the current slide shows.
    fireEvent.load(document.querySelector(`img[src="${backdropSrc(1)}"]`)!);
    expect(screen.getAllByTestId("hero-backdrop")[1]).toHaveAttribute("data-visible", "false");
  });
});
