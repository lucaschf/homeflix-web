import { useState } from "react";
import { ThemeProvider } from "@mui/material";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { MaturityLimitSelector } from "./MaturityLimitSelector";

function renderSelector({
  value = null,
  storedLimit = value,
  disabled = false,
  columns,
}: {
  value?: number | null;
  storedLimit?: number | null;
  disabled?: boolean;
  columns?: number;
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
        columns={columns}
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

/** The card (the radio's ``<label>``) holding the option with this name. */
const card = (name: string) => screen.getByRole("radio", { name }).closest("label")!;

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("MaturityLimitSelector — options", () => {
  it.each([
    ["All ages", "Only titles rated for all audiences.", "L", "rgb(12, 148, 71)"],
    ["Up to age 10", "Titles rated L and 10.", "10", "rgb(1, 145, 212)"],
    ["Up to age 12", "Titles rated L, 10 and 12.", "12", "rgb(245, 210, 24)"],
    ["Up to age 14", "Everything from L to 14, including PG-13.", "14", "rgb(240, 134, 42)"],
    ["Up to age 16", "Everything from L to 16. 18 and R stay out.", "16", "rgb(228, 32, 42)"],
  ])("renders %s with its description and the ClassInd badge", (name, description, badge, color) => {
    renderSelector();

    const radio = screen.getByRole("radio", { name });
    expect(radio).toHaveAccessibleDescription(description);
    expect(within(card(name)).getByText(description)).toBeVisible();
    expect(within(card(name)).getByText(badge).parentElement).toHaveStyle({
      backgroundColor: color,
    });
  });

  it("renders Unrestricted with its description and a neutral globe tile", () => {
    renderSelector();

    const radio = screen.getByRole("radio", { name: "Unrestricted" });
    expect(radio).toHaveAccessibleDescription("The whole catalog, including unrated titles.");
    expect(card("Unrestricted").querySelector("svg.lucide-globe")).toBeInTheDocument();
  });

  it.each([
    ["Unrestricted", null],
    ["All ages", 0],
    ["Up to age 10", 10],
    ["Up to age 12", 12],
    ["Up to age 14", 14],
    ["Up to age 16", 16],
  ])("selecting %s reports limit %s", async (name, limit) => {
    // 18 is outside the steps, so every step is a change.
    const onChange = renderSelector({ value: 18 });

    await userEvent.click(screen.getByRole("radio", { name }));

    expect(onChange).toHaveBeenCalledExactlyOnceWith(limit);
    expect(screen.getByRole("radio", { name })).toBeChecked();
  });

  it("moves the selection with the arrow keys", async () => {
    const onChange = renderSelector({ value: 12 });

    await userEvent.click(screen.getByRole("radio", { name: "Up to age 12" }));
    expect(onChange).not.toHaveBeenCalled();

    await userEvent.keyboard("{ArrowDown}");
    expect(onChange).toHaveBeenLastCalledWith(14);
    expect(screen.getByRole("radio", { name: "Up to age 14" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Up to age 14" })).toHaveFocus();

    await userEvent.keyboard("{ArrowUp}{ArrowUp}{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(screen.getByRole("radio", { name: "All ages" })).toBeChecked();

    await userEvent.keyboard("{ArrowUp}");
    expect(onChange).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("radio", { name: "Unrestricted" })).toBeChecked();
  });

  it("selects the focused option with the space bar", async () => {
    const onChange = renderSelector({ value: null });

    screen.getByRole("radio", { name: "Up to age 16" }).focus();
    await userEvent.keyboard(" ");

    expect(onChange).toHaveBeenCalledExactlyOnceWith(16);
    expect(screen.getByRole("radio", { name: "Up to age 16" })).toBeChecked();
  });

  it("names the group after its legend", () => {
    renderSelector();

    expect(screen.getByRole("radiogroup", { name: "Age limit" })).toBeInTheDocument();
  });

  it("shows a limit stored outside the steps as the selected custom option, and keeps it listed", async () => {
    const onChange = renderSelector({ value: 18 });

    const custom = screen.getByRole("radio", { name: "Up to age 18" });
    expect(custom).toBeChecked();
    expect(custom).toHaveAccessibleDescription("A custom limit, set outside these options.");
    expect(within(card("Up to age 18")).getByText("18")).toBeInTheDocument();
    expect(screen.getAllByRole("radio").map((radio) => radio.getAttribute("value"))).toEqual([
      "unrestricted",
      "0",
      "10",
      "12",
      "14",
      "16",
      "18",
    ]);

    await userEvent.click(screen.getByRole("radio", { name: "Up to age 12" }));
    await userEvent.click(screen.getByRole("radio", { name: "Up to age 18" }));

    expect(onChange).toHaveBeenLastCalledWith(18);
    expect(screen.getByRole("radio", { name: "Up to age 18" })).toBeChecked();
  });

  it("disables every option while the form is submitting", () => {
    renderSelector({ value: 12, disabled: true });

    for (const radio of screen.getAllByRole("radio")) expect(radio).toBeDisabled();
  });

  it.each([
    [undefined, "repeat(1, minmax(0, 1fr))"],
    [2, "repeat(2, minmax(0, 1fr))"],
  ])("lays the options out in a grid of %s columns", (columns, template) => {
    renderSelector({ columns });

    expect(screen.getByRole("radiogroup", { name: "Age limit" })).toHaveStyle({
      gridTemplateColumns: template,
    });
  });
});

describe("MaturityLimitSelector — what the profile sees", () => {
  it.each([
    [0, "Sees: L. Doesn't see: 10, 12, 14, 16, 18 and unrated titles."],
    [12, "Sees: L, 10, 12. Doesn't see: 14, 16, 18 and unrated titles."],
    [16, "Sees: L, 10, 12, 14, 16. Doesn't see: 18 and unrated titles."],
    [null, "Sees: L, 10, 12, 14, 16, 18 and unrated titles."],
  ])("limit %s reads as “%s”", (limit, sentence) => {
    renderSelector({ value: limit });

    expect(screen.getByText(sentence)).toBeInTheDocument();
  });

  it.each([
    [0, false],
    [12, false],
    [16, false],
    [null, true],
  ])("limit %s draws the unrated chip as allowed: %s", (limit, allowed) => {
    renderSelector({ value: limit });

    const chip = screen.getByText("Unrated");
    if (allowed) expect(chip).not.toHaveStyle({ textDecoration: "line-through" });
    else expect(chip).toHaveStyle({ textDecoration: "line-through" });
  });

  it("reaches unrated titles from a stored limit of 18, as the backend does", () => {
    renderSelector({ value: 18 });

    expect(screen.getByText("Sees: L, 10, 12, 14, 16, 18 and unrated titles.")).toBeInTheDocument();
  });

  it("follows the selection", async () => {
    renderSelector({ value: 12 });

    await userEvent.click(screen.getByRole("radio", { name: "Up to age 14" }));

    expect(
      screen.getByText("Sees: L, 10, 12, 14. Doesn't see: 16, 18 and unrated titles."),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Doesn't see: 14,/)).not.toBeInTheDocument();
  });

  it("reads in Portuguese", async () => {
    await i18n.changeLanguage("pt-BR");
    renderSelector({ value: 12 });

    expect(
      screen.getByText("Vê: L, 10, 12. Não vê: 14, 16, 18 e títulos sem classificação."),
    ).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Até 12 anos" })).toBeChecked();
  });
});

describe("MaturityLimitSelector — how it works", () => {
  it.each([
    ["en", "How it works", [/PG and PG-13 = 13\b/, /R and TV-MA = 17\b/, /NC-17 = 18\b/, /TV-PG = 10 and TV-14 = 14\b/, /Unrated titles count as age 18/, /parental PIN/]],
    ["pt-BR", "Como funciona", [/PG e PG-13 = 13\b/, /R e TV-MA = 17\b/, /NC-17 = 18\b/, /TV-PG = 10 e TV-14 = 14\b/, /Títulos sem classificação contam como 18 anos/, /PIN parental/]],
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

    const toggle = screen.getByRole("button", { name: "How it works" });
    const note = screen.getByRole("note", { name: "How it works" });
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
      within(screen.getByRole("note", { name: "How it works" })).getByText(
        /video the server has already cached can still be reached/,
      ),
    ).toBeInTheDocument();
  });
});
