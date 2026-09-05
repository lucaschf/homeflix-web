import { describe, expect, it } from "vitest";
import { formatGenreList } from "./genreList";

describe("formatGenreList", () => {
  it("returns the single genre as-is", () => {
    expect(formatGenreList(["Ficção científica"], "e")).toBe("Ficção científica");
  });

  it("joins two genres with the conjunction", () => {
    expect(formatGenreList(["Ficção científica", "Aventura"], "e")).toBe(
      "Ficção científica e Aventura",
    );
  });

  it("uses commas before the conjunction for three or more", () => {
    expect(formatGenreList(["Sci-fi", "Adventure", "Drama"], "and")).toBe(
      "Sci-fi, Adventure and Drama",
    );
  });

  it("yields an empty string for an empty or blank list", () => {
    expect(formatGenreList([], "e")).toBe("");
    expect(formatGenreList(["", "  "], "e")).toBe("");
  });
});
