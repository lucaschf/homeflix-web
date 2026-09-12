import { describe, expect, it } from "vitest";
import { genreNameSet, ownsGenreRow, selectGenreRowItems } from "./genreRows";
import type { Genre } from "../api/types";

/** The genre labels a page lays its rows out from. */
const GENRES: Genre[] = [
  { id: "Action", name: "Ação", count: 248 },
  { id: "Horror", name: "Terror", count: 230 },
  { id: "Thriller", name: "Suspense", count: 202 },
  { id: "Mystery", name: "Mistério", count: 71 },
];
const KNOWN = genreNameSet(GENRES);

/** A catalog row, reduced to what the row rule reads. */
function item(title: string, ...genres: string[]) {
  return { title, genres };
}

describe("ownsGenreRow", () => {
  it("gives a title to its first genre and to no other", () => {
    const movie = item("Alien", "Terror", "Suspense", "Ação");
    expect(ownsGenreRow(movie, "Terror", KNOWN)).toBe(true);
    expect(ownsGenreRow(movie, "Suspense", KNOWN)).toBe(false);
    expect(ownsGenreRow(movie, "Ação", KNOWN)).toBe(false);
  });

  it("compares labels ignoring case and padding", () => {
    expect(ownsGenreRow(item("X", " ficção Científica ", "terror"), "Terror", KNOWN)).toBe(true);
  });

  it("falls through to the first genre that has a row on this page", () => {
    // The Movies tab's genres list has no "Sci-Fi & Fantasy" row, so a
    // title tagged with it lands in the next genre it carries.
    const movie = item("Duna", "Sci-Fi & Fantasy", "Ação", "Suspense");
    expect(ownsGenreRow(movie, "Ação", KNOWN)).toBe(true);
    expect(ownsGenreRow(movie, "Suspense", KNOWN)).toBe(false);
  });

  it("never hides a title no row can claim", () => {
    // Divergent translation, or genres the page doesn't list: showing it
    // twice beats dropping it out of the catalog.
    const orphan = item("Rarity", "Documentaire");
    expect(ownsGenreRow(orphan, "Ação", KNOWN)).toBe(true);
    expect(ownsGenreRow(orphan, "Terror", KNOWN)).toBe(true);
    expect(ownsGenreRow(item("Untagged"), "Ação", KNOWN)).toBe(true);
  });

  it("degrades to the pre-dedupe row before the genres list resolves", () => {
    const empty = genreNameSet(undefined);
    const movie = item("Alien", "Terror", "Suspense");
    expect(ownsGenreRow(movie, "Terror", empty)).toBe(true);
    expect(ownsGenreRow(movie, "Suspense", empty)).toBe(true);
  });
});

describe("selectGenreRowItems", () => {
  const horrorFirst = [item("A", "Terror"), item("B", "Terror", "Suspense")];
  const thrillerFirst = [item("C", "Suspense", "Terror"), item("D", "Suspense")];

  it("keeps only what the row owns once it is wide enough", () => {
    const items = [...horrorFirst, ...thrillerFirst];
    expect(selectGenreRowItems(items, "Terror", KNOWN, 2).map((i) => i.title)).toEqual(["A", "B"]);
  });

  it("tops a thin row up with titles it only shares", () => {
    // Mistério's shape: one primary in the page, the rest borrowed.
    const items = [
      item("A", "Mistério"),
      item("B", "Suspense", "Mistério"),
      item("C", "Terror", "Mistério"),
      item("D", "Ação", "Mistério"),
    ];
    expect(selectGenreRowItems(items, "Mistério", KNOWN, 3).map((i) => i.title)).toEqual([
      "A",
      "B",
      "C",
    ]);
  });

  it("keeps the listing's order when it borrows", () => {
    // "A" is borrowed and "B" is owned: the row must not float the
    // owned one to the front and break the alphabetical listing.
    const items = [item("A", "Ação", "Terror"), item("B", "Terror")];
    expect(selectGenreRowItems(items, "Terror", KNOWN, 2).map((i) => i.title)).toEqual(["A", "B"]);
  });

  it("borrows nothing beyond what the row is short by", () => {
    const items = [item("A", "Terror"), item("B", "Ação", "Terror"), item("C", "Ação", "Terror")];
    expect(selectGenreRowItems(items, "Terror", KNOWN, 2).map((i) => i.title)).toEqual(["A", "B"]);
  });

  it("returns what it has when the page can't fill the row", () => {
    const items = [item("A", "Ação", "Música")];
    expect(selectGenreRowItems(items, "Música", KNOWN, 8).map((i) => i.title)).toEqual(["A"]);
  });
});
