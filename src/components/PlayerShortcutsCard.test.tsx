import { ThemeProvider } from "@mui/material";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { theme } from "../theme";
import {
  BACKWARD_SEEK_SECONDS,
  FORWARD_SEEK_SECONDS,
  SHORTCUT_GROUPS,
} from "../utils/playerShortcuts";
import { PlayerShortcutsCard } from "./PlayerShortcutsCard";

function renderCard({ hasEpisodes = true, onClose = vi.fn() } = {}) {
  render(
    <ThemeProvider theme={theme}>
      <PlayerShortcutsCard onClose={onClose} hasEpisodes={hasEpisodes} />
    </ThemeProvider>,
  );
  return onClose;
}

beforeEach(async () => {
  await i18n.changeLanguage("en");
});

describe("PlayerShortcutsCard", () => {
  it("draws a cap for every key in the map", () => {
    renderCard();

    const caps = SHORTCUT_GROUPS.flatMap((group) =>
      group.items.flatMap((item) => item.keys),
    );
    // One <kbd> per cap — the count catches a group that silently
    // stopped rendering as much as a key that was never drawn.
    expect(document.querySelectorAll("kbd")).toHaveLength(caps.length);
    for (const group of SHORTCUT_GROUPS) {
      expect(screen.getByText(i18n.t(group.titleKey))).toBeInTheDocument();
    }
  });

  it("advertises the seek distances the player actually uses", () => {
    renderCard();

    expect(screen.getByText(`Back ${BACKWARD_SEEK_SECONDS}s`)).toBeInTheDocument();
    expect(screen.getByText(`Forward ${FORWARD_SEEK_SECONDS}s`)).toBeInTheDocument();
  });

  it("keeps the episode keys off a movie", () => {
    // A movie has no next episode; a row for `N` would be advertising a
    // key that does nothing.
    renderCard({ hasEpisodes: false });

    expect(screen.queryByText("Episodes")).not.toBeInTheDocument();
    expect(screen.queryByText("Next episode")).not.toBeInTheDocument();
    // The rest of the map is unaffected.
    expect(screen.getByText("Playback")).toBeInTheDocument();
  });

  it("closes on the scrim but not on the card", () => {
    const onClose = renderCard({ onClose: vi.fn() });

    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId("shortcuts-scrim"));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
