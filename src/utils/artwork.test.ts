import { describe, expect, it } from "vitest";
import { artworkSrcSet, artworkUrl, sizesFor } from "./artwork";

const LOCAL = "/api/v1/artwork/abc123.jpg";
const TMDB = "https://image.tmdb.org/t/p/original/poster.jpg";

describe("artworkUrl", () => {
  it("asks the mirror for a width with ?w=", () => {
    expect(artworkUrl(LOCAL, 500)).toBe("/api/v1/artwork/abc123.jpg?w=500");
  });

  it("keeps existing query parameters on a mirrored URL", () => {
    expect(artworkUrl(`${LOCAL}?v=3`, 500)).toBe("/api/v1/artwork/abc123.jpg?v=3&w=500");
  });

  it("never re-sizes a mirrored variant key", () => {
    expect(artworkUrl("/api/v1/artwork/abc123.w780.jpg", 500)).toBe(
      "/api/v1/artwork/abc123.w780.jpg",
    );
  });

  it("swaps the TMDB size segment", () => {
    expect(artworkUrl(TMDB, 780)).toBe("https://image.tmdb.org/t/p/w780/poster.jpg");
    expect(artworkUrl("https://image.tmdb.org/t/p/w1280/x.jpg", 500)).toBe(
      "https://image.tmdb.org/t/p/w500/x.jpg",
    );
  });

  it("passes anything else through untouched", () => {
    for (const url of ["/api/v1/scrub/sprite-0.jpg", "data:image/png;base64,AAAA", "/flags/br.svg"]) {
      expect(artworkUrl(url, 500)).toBe(url);
    }
  });
});

describe("artworkSrcSet", () => {
  it("lists the ladder plus the original, largest variant as src", () => {
    expect(artworkSrcSet(LOCAL, "backdrop")).toEqual({
      src: "/api/v1/artwork/abc123.jpg?w=1280",
      srcSet:
        "/api/v1/artwork/abc123.jpg?w=780 780w, /api/v1/artwork/abc123.jpg?w=1280 1280w, /api/v1/artwork/abc123.jpg 3840w",
    });
  });

  it("uses the provider ladder for remote URLs", () => {
    expect(artworkSrcSet(TMDB, "poster").srcSet).toBe(
      "https://image.tmdb.org/t/p/w342/poster.jpg 342w, https://image.tmdb.org/t/p/w500/poster.jpg 500w, https://image.tmdb.org/t/p/original/poster.jpg 2000w",
    );
  });

  it("leaves a non-resizable URL as a plain src", () => {
    expect(artworkSrcSet("/api/v1/scrub/sprite-0.jpg", "still")).toEqual({
      src: "/api/v1/scrub/sprite-0.jpg",
    });
  });
});

describe("sizesFor", () => {
  it("maps MUI breakpoints to min-width queries, largest first", () => {
    expect(sizesFor({ xs: 140, sm: 200, md: 240, lg: 280 })).toBe(
      "(min-width:1536px) 280px, (min-width:1200px) 280px, (min-width:900px) 240px, (min-width:600px) 200px, 140px",
    );
  });

  it("carries a missing step forward like MUI responsive values", () => {
    expect(sizesFor({ xs: 260, md: 480, xl: 560 })).toBe(
      "(min-width:1536px) 560px, (min-width:1200px) 480px, (min-width:900px) 480px, (min-width:600px) 260px, 260px",
    );
  });
});
