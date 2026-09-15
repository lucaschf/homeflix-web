import { useState } from "react";
import { ThemeProvider } from "@mui/material";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { MaturityLimitSelector } from "./MaturityLimitSelector";

function renderSelector({
  value = null,
  storedLimit = value,
  disabled = false,
}: {
  value?: number | null;
  storedLimit?: number | null;
  disabled?: boolean;
} = {}) {
  const onChange = vi.fn<(limit: number | null) => void>();
  // The form owns the value; mirror that so a pick shows up as selected.
  function Harness() {
    const [limit, setLimit] = useState(value);
    return (
      <MaturityLimitSelector
        value={limit}
        storedLimit={storedLimit}
        disabled={disabled}
        onChange={(next) => {
          onChange(next);
          setLimit(next);
        }}
      />
    );
  }
  render(
    <ThemeProvider theme={theme}>
      <Harness />
    </ThemeProvider>,
  );
  return onChange;
}

const slider = () => screen.getByRole("slider", { name: "Age limit" });

/**
 * The ladder step drawn for ``limit`` (``null`` = unrestricted). The drawing
 * is hidden from assistive technology — the slider speaks for it — so the
 * tests reach a step through its data attribute, as a pointer would.
 */
const step = (limit: number | null) =>
  document.querySelector<HTMLElement>(`[data-step="${limit ?? "unrestricted"}"]`)!;

const drawnSteps = () =>
  [...document.querySelectorAll<HTMLElement>("[data-step]")].map((element) => element.dataset.step);

const dimmedSteps = () =>
  [...document.querySelectorAll<HTMLElement>("[data-step][data-dimmed]")].map(
    (element) => element.dataset.step,
  );

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("MaturityLimitSelector — ladder", () => {
  it("draws L to 16 as ClassInd badges, then an unrestricted infinity tile, with no 18 step", () => {
    renderSelector();

    expect(drawnSteps()).toEqual(["0", "10", "12", "14", "16", "unrestricted"]);
    expect(step(null).querySelector("svg.lucide-infinity")).toBeInTheDocument();
  });

  it.each([
    [0, "L", "All ages", "rgb(12, 148, 71)"],
    [10, "10", "10", "rgb(1, 145, 212)"],
    [12, "12", "12", "rgb(245, 210, 24)"],
    [14, "14", "14", "rgb(240, 134, 42)"],
    [16, "16", "16", "rgb(228, 32, 42)"],
  ])("draws step %s with the %s badge and the caption “%s”", (limit, badge, caption, color) => {
    renderSelector();

    expect(within(step(limit)).getAllByText(badge)[0].parentElement).toHaveStyle({
      backgroundColor: color,
    });
    expect(step(limit).lastElementChild).toHaveTextContent(new RegExp(`^${caption}$`));
  });

  it("captions the infinity tile Unrestricted", () => {
    renderSelector();

    expect(step(null).lastElementChild).toHaveTextContent(/^Unrestricted$/);
  });

  it("names the slider after its heading", () => {
    renderSelector();

    expect(slider()).toBeInTheDocument();
  });

  it.each([
    [null, "Unrestricted"],
    [0, "All ages"],
    [10, "Up to age 10"],
    [12, "Up to age 12"],
    [14, "Up to age 14"],
    [16, "Up to age 16"],
  ])("clicking the %s step reports it and reads as “%s”", async (limit, title) => {
    // 18 is outside the steps, so every step is a change.
    const onChange = renderSelector({ value: 18 });

    await userEvent.click(step(limit));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(limit);
    expect(slider()).toHaveAttribute("aria-valuetext", title);
    expect(step(limit)).toHaveAttribute("data-selected", "true");
    expect(document.querySelectorAll("[data-step][data-selected]")).toHaveLength(1);
  });

  it("reports nothing when the selected step is clicked again", async () => {
    const onChange = renderSelector({ value: 12 });

    await userEvent.click(step(12));

    expect(onChange).not.toHaveBeenCalled();
  });

  it("moves one step at a time with the arrow keys and jumps with Home and End", async () => {
    const onChange = renderSelector({ value: 12 });
    slider().focus();

    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledExactlyOnceWith(14);
    expect(slider()).toHaveAttribute("aria-valuetext", "Up to age 14");

    await userEvent.keyboard("{End}");
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(slider()).toHaveAttribute("aria-valuetext", "Unrestricted");

    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledTimes(2);

    await userEvent.keyboard("{Home}");
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(slider()).toHaveAttribute("aria-valuetext", "All ages");

    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenCalledTimes(3);

    await userEvent.keyboard("{ArrowRight}{ArrowRight}{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith(10);
    expect(slider()).toHaveAttribute("aria-valuetext", "Up to age 10");
  });

  it("takes the keyboard focus from a click, so the arrows continue from there", async () => {
    const onChange = renderSelector({ value: null });

    await userEvent.click(step(10));
    expect(slider()).toHaveFocus();
    await userEvent.keyboard("{ArrowLeft}");

    expect(onChange).toHaveBeenLastCalledWith(0);
  });

  it("drags along the rail, snapping to the column under the pointer", () => {
    const onChange = renderSelector({ value: 12 });
    const columns = step(0).parentElement!;
    // jsdom has no layout: six 100px columns.
    vi.spyOn(columns, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 0, 600, 60));
    const ladder = slider().parentElement!;

    fireEvent.pointerDown(ladder, { button: 0, clientX: 450 });
    expect(onChange).toHaveBeenLastCalledWith(16);
    fireEvent.pointerMove(ladder, { clientX: 590 });
    expect(onChange).toHaveBeenLastCalledWith(null);
    fireEvent.pointerMove(ladder, { clientX: 120 });
    expect(onChange).toHaveBeenLastCalledWith(10);
    fireEvent.pointerUp(ladder, { clientX: 120 });
    fireEvent.pointerMove(ladder, { clientX: 20 });

    expect(onChange.mock.calls).toEqual([[16], [null], [10]]);
    expect(slider()).toHaveAttribute("aria-valuetext", "Up to age 10");
  });

  it("reads the steps in Portuguese", async () => {
    await i18n.changeLanguage("pt-BR");
    renderSelector({ value: 12 });

    expect(screen.getByRole("slider", { name: "Limite de idade" })).toHaveAttribute(
      "aria-valuetext",
      "Até 12 anos",
    );
    await userEvent.keyboard("{Tab}{End}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Irrestrito");
    await userEvent.keyboard("{Home}");
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "Livre");
  });

  it("places a limit stored outside the steps on the ladder, selected, and keeps it there", async () => {
    const onChange = renderSelector({ value: 18 });

    expect(drawnSteps()).toEqual(["0", "10", "12", "14", "16", "18", "unrestricted"]);
    expect(step(18)).toHaveAttribute("data-selected", "true");
    expect(step(18).lastElementChild).toHaveTextContent(/^18$/);
    expect(slider()).toHaveAttribute("aria-valuetext", "Up to age 18");
    expect(slider()).toHaveAccessibleDescription(
      "A custom limit, set outside these options. Sees the whole catalog, unrated titles included.",
    );

    await userEvent.click(step(12));
    await userEvent.click(step(18));

    expect(onChange).toHaveBeenLastCalledWith(18);
    expect(step(18)).toHaveAttribute("data-selected", "true");
  });

  it("orders a stored 13 between 12 and 14", () => {
    renderSelector({ value: 13 });

    expect(drawnSteps()).toEqual(["0", "10", "12", "13", "14", "16", "unrestricted"]);
    expect(dimmedSteps()).toEqual(["14", "16", "unrestricted"]);
  });

  it.each([
    [null, []],
    [0, ["10", "12", "14", "16", "unrestricted"]],
    [12, ["14", "16", "unrestricted"]],
    [16, ["unrestricted"]],
  ])("with limit %s, dims only the steps above it: %j", (limit, dimmed) => {
    renderSelector({ value: limit });

    expect(dimmedSteps()).toEqual(dimmed);
  });

  it("disables the slider and ignores the pointer while the form is submitting", async () => {
    const onChange = renderSelector({ value: 12, disabled: true });

    expect(slider()).toBeDisabled();
    await userEvent.click(step(16));

    expect(onChange).not.toHaveBeenCalled();
  });
});

describe("MaturityLimitSelector — selected step detail", () => {
  it.each([
    [0, "All ages", "Only titles rated for all audiences.", "Doesn't see: 10, 12, 14, 16, 18 and unrated titles."],
    [12, "Up to age 12", "Titles rated L, 10 and 12.", "Doesn't see: 14, 16, 18 and unrated titles."],
    [16, "Up to age 16", "Everything from L to 16. 18 and R stay out.", "Doesn't see: 18 and unrated titles."],
  ])("limit %s reads as “%s”, with its description and the exact reach line", (limit, title, description, reach) => {
    renderSelector({ value: limit });

    // Title, description and reach line, in that order, beside the badge.
    const detail = screen.getByText(description).parentElement!;
    expect([...detail.children].map((line) => line.textContent)).toEqual([
      title,
      description,
      reach,
    ]);
    expect(slider()).toHaveAccessibleDescription(`${description} ${reach}`);
  });

  it("has no “doesn't see” line for Unrestricted", () => {
    renderSelector({ value: null });

    const detail = screen.getByText("The whole catalog, including unrated titles.").parentElement!;
    expect([...detail.children].map((line) => line.textContent)).toEqual([
      "Unrestricted",
      "The whole catalog, including unrated titles.",
    ]);
    expect(screen.queryByText(/Doesn't see/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Sees the whole catalog/)).not.toBeInTheDocument();
    expect(slider()).toHaveAccessibleDescription("The whole catalog, including unrated titles.");
  });

  it("reaches unrated titles from a stored limit of 18, as the backend does", () => {
    renderSelector({ value: 18 });

    expect(screen.getByText("Sees the whole catalog, unrated titles included.")).toBeInTheDocument();
    expect(screen.queryByText(/Doesn't see/)).not.toBeInTheDocument();
  });

  it("follows the selection", async () => {
    renderSelector({ value: 12 });

    await userEvent.click(step(14));

    expect(screen.getByText("Up to age 14")).toBeInTheDocument();
    expect(screen.getByText("Doesn't see: 16, 18 and unrated titles.")).toBeInTheDocument();
    expect(screen.queryByText(/Doesn't see: 14,/)).not.toBeInTheDocument();
  });

  it("reads in Portuguese", async () => {
    await i18n.changeLanguage("pt-BR");
    renderSelector({ value: 12 });

    expect(screen.getByText("Até 12 anos")).toBeInTheDocument();
    expect(screen.getByText("Não vê: 14, 16, 18 e títulos sem classificação.")).toBeInTheDocument();
  });
});

describe("MaturityLimitSelector — how ratings work", () => {
  it.each([
    ["en", "How ratings work", [/PG and PG-13 = 13\b/, /R and TV-MA = 17\b/, /NC-17 = 18\b/, /TV-PG = 10 and TV-14 = 14\b/, /Unrated titles count as age 18/, /parental PIN/]],
    ["pt-BR", "Como funciona a classificação", [/PG e PG-13 = 13\b/, /R e TV-MA = 17\b/, /NC-17 = 18\b/, /TV-PG = 10 e TV-14 = 14\b/, /Títulos sem classificação contam como 18 anos/, /PIN parental/]],
  ])("states the US conversion, the unrated rule and the PIN (%s)", async (language, title, facts) => {
    await i18n.changeLanguage(language);
    renderSelector();

    const note = screen.getByRole("note", { name: title });
    for (const fact of facts) expect(note).toHaveTextContent(fact);
    // The line-keeping markup renders as elements, never as literal tags.
    expect(note.textContent).not.toMatch(/<\/?pair>/);
  });

  it("starts collapsed and opens from its title button, by pointer or keyboard", async () => {
    renderSelector();

    const toggle = screen.getByRole("button", { name: "How ratings work" });
    const note = screen.getByRole("note", { name: "How ratings work" });
    const pinFact = within(note).getByText(/parental PIN/);
    expect(note).toContainElement(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(pinFact).not.toBeVisible();

    await userEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(document.getElementById(toggle.getAttribute("aria-controls")!)).toContainElement(
      pinFact,
    );
    expect(pinFact).toBeVisible();

    await userEvent.keyboard("{Enter}");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await userEvent.keyboard(" ");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
  });

  it("keeps the cached-video caveat in the note", () => {
    renderSelector();

    expect(
      within(screen.getByRole("note", { name: "How ratings work" })).getByText(
        /video the server has already cached can still be reached/,
      ),
    ).toBeInTheDocument();
  });
});
