import { ThemeProvider } from "@mui/material";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { theme } from "../theme";
import { TitleLogo } from "./TitleLogo";

const LOGO_A = "https://image.tmdb.org/t/p/original/a.png";
const LOGO_B = "https://image.tmdb.org/t/p/original/b.png";

function renderLogo(logoUrl: string | null) {
  return render(
    <ThemeProvider theme={theme}>
      <TitleLogo logoUrl={logoUrl} title="Duna" />
    </ThemeProvider>,
  );
}

const pendingText = () => screen.queryByTestId("title-logo-pending");

describe("TitleLogo — loading states", () => {
  it("renders plain text when there is no logo", () => {
    renderLogo(null);

    expect(screen.getByRole("heading", { name: "Duna" })).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("shows the title as text while the logo is still downloading", () => {
    renderLogo(LOGO_A);

    expect(screen.getByRole("img", { name: "Duna" })).toHaveAttribute("src", LOGO_A);
    expect(pendingText()).toHaveTextContent("Duna");
  });

  it("swaps the text out once the logo has loaded", () => {
    renderLogo(LOGO_A);

    fireEvent.load(screen.getByRole("img", { name: "Duna" }));

    expect(pendingText()).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Duna" })).toBeInTheDocument();
  });

  it("falls back to the text heading when the logo fails", () => {
    renderLogo(LOGO_A);

    fireEvent.error(screen.getByRole("img", { name: "Duna" }));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Duna" })).toBeInTheDocument();
  });

  it("retries the image for a new URL after an earlier one failed", () => {
    const { rerender } = renderLogo(LOGO_A);
    fireEvent.error(screen.getByRole("img", { name: "Duna" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();

    rerender(
      <ThemeProvider theme={theme}>
        <TitleLogo logoUrl={LOGO_B} title="Duna" />
      </ThemeProvider>,
    );

    expect(screen.getByRole("img", { name: "Duna" })).toHaveAttribute("src", LOGO_B);
  });
});
