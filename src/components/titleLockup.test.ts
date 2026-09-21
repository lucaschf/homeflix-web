import { describe, expect, it } from "vitest";
import { LOGO_ASPECT } from "./titleLogoSizing";
import { LOCKUP_LINE_HEIGHT, lineEm, titleLockup, type LockupFrame } from "./titleLockup";

/** A tall poster-card frame: stacks every multi-word title. */
const POSTER: LockupFrame = {
  maxHeight: 1.5,
  lineMax: 0.3,
  maxLines: 5,
  oneLineMin: Infinity,
  settleSize: Infinity,
};

const TITLES = [
  "Duna",
  "Mad Max",
  "Dark Descent",
  "A Viagem de Chihiro",
  "Symphony in Slang",
  "Perigo na Torre",
  "Guerreiros da Virtude",
  "Quando os Dinossauros Reinavam na Terra",
  "O Senhor dos Anéis: A Sociedade do Anel",
  "The Lord of the Rings: The Return of the King",
  "Supercalifragilisticexpialidocious",
];

describe("lineEm", () => {
  it("measures accented caps like their base letter", () => {
    expect(lineEm("Ação")).toBeCloseTo(lineEm("ACAO"));
  });

  it("gives full-width scripts a full em per character", () => {
    expect(lineEm("千と千尋")).toBe(4);
  });
});

describe("titleLockup", () => {
  it("breaks before the name, not after a connector", () => {
    expect(titleLockup("A Viagem de Chihiro").lines).toEqual(["A Viagem de", "Chihiro"]);
  });

  it("scales the short line up to the long line's width", () => {
    const { lines, sizes } = titleLockup("A Viagem de Chihiro");
    const widths = lines.map((line, i) => lineEm(line) * sizes[i]);

    expect(sizes[1]).toBeGreaterThan(sizes[0]);
    expect(widths[1]).toBeCloseTo(widths[0], 2);
  });

  it("keeps a short title on one line", () => {
    expect(titleLockup("Mad Max").lines).toEqual(["Mad Max"]);
    expect(titleLockup("Dark Descent").lines).toEqual(["Dark Descent"]);
  });

  it("breaks at the title's own colon when that balances", () => {
    expect(titleLockup("O Senhor dos Anéis: A Sociedade do Anel").lines).toEqual([
      "O Senhor dos Anéis:",
      "A Sociedade do Anel",
    ]);
  });

  it("drops the separator dash where the title breaks", () => {
    expect(titleLockup("Skeeters - Asas da Morte").lines).toEqual(["Skeeters", "Asas da Morte"]);
  });

  it("keeps a dash that stays inside a line", () => {
    expect(titleLockup("Up - Altas").lines).toEqual(["Up - Altas"]);
  });

  it.each(TITLES)("fits %s inside the logo box", (title) => {
    const { lines, sizes } = titleLockup(title);
    const height = sizes.reduce((sum, size) => sum + size * LOCKUP_LINE_HEIGHT, 0);

    expect(lines.join(" ")).toBe(title);
    expect(lines.length).toBeLessThanOrEqual(3);
    expect(height).toBeLessThanOrEqual(1 / LOGO_ASPECT + 1e-9);
    lines.forEach((line, i) => expect(lineEm(line) * sizes[i]).toBeLessThanOrEqual(1 + 1e-9));
  });
});

describe("titleLockup — poster frame", () => {
  it("stacks a short multi-word title", () => {
    expect(titleLockup("Mad Max", POSTER).lines).toEqual(["Mad", "Max"]);
  });

  it("never leaves a short word or connector on a line of its own", () => {
    expect(titleLockup("A Hora do Rush", POSTER).lines).toEqual(["A Hora", "do Rush"]);
    expect(titleLockup("Toy Story 3", POSTER).lines).toEqual(["Toy", "Story 3"]);
  });

  it("keeps a title on one line when every break would orphan a word", () => {
    expect(titleLockup("Up: A", POSTER).lines).toEqual(["Up: A"]);
  });

  it.each(TITLES)("fits %s inside a poster", (title) => {
    const { lines, sizes } = titleLockup(title, POSTER);
    const height = sizes.reduce((sum, size) => sum + size * LOCKUP_LINE_HEIGHT, 0);

    expect(lines.join(" ")).toBe(title);
    expect(lines.length).toBeLessThanOrEqual(5);
    expect(height).toBeLessThanOrEqual(1.5 + 1e-9);
    lines.forEach((line, i) => expect(lineEm(line) * sizes[i]).toBeLessThanOrEqual(1 + 1e-9));
  });
});
