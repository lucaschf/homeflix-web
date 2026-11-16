import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import i18n from "../../i18n";
import { theme } from "../../theme";
import { HlsCacheAdmin } from "./HlsCacheAdmin";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

function renderPage() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <MemoryRouter>
          <HlsCacheAdmin />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("HLS cache occupancy", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    vi.clearAllMocks();
  });

  it("says the size is being measured until the server has measured it", async () => {
    // The server measures the cache in its eviction sweep. Until the first
    // sweep after startup ends there is no size, which is not an empty cache.
    apiGet.mockResolvedValue({
      data: { size_bytes: null, max_bytes: 1024, last_cleared_at: null },
    });

    renderPage();

    expect(await screen.findAllByText("Measuring…")).not.toHaveLength(0);
    expect(screen.queryByText(/null/)).not.toBeInTheDocument();
    // Neither the badge nor the bar may read as a measured (empty) cache.
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).not.toHaveAttribute("aria-valuenow");
    expect(screen.getByRole("button", { name: "Clear cache" })).toBeEnabled();
  });

  it("shows the measured size against the cap", async () => {
    apiGet.mockResolvedValue({
      data: { size_bytes: 512, max_bytes: 1024, last_cleared_at: null },
    });

    renderPage();

    expect(await screen.findByText("50 %")).toBeInTheDocument();
    expect(screen.queryByText("Measuring…")).not.toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "50");
  });
});
