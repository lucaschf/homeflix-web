import { ThemeProvider } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { describe, expect, it, vi } from "vitest";
import "../i18n";
import { theme } from "../theme";
import { MediaCard } from "./MediaCard";
import { ToastProvider } from "./ToastProvider";

// The card reaches the backend only through the Continue Watching and
// watchlist hooks; stub the client so those queries resolve quietly.
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

const POSTER = "https://image.tmdb.org/t/p/original/poster.jpg";

function renderCard(props: Partial<ComponentProps<typeof MediaCard>>) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <MediaCard title="A Hora do Rush" {...props} />
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

describe("MediaCard — missing artwork", () => {
  it("sets the title as generated artwork when there is no image", () => {
    renderCard({});

    const art = screen.getByRole("img", { name: "A Hora do Rush" });
    expect(art.tagName).not.toBe("IMG");
    expect(art).toHaveTextContent("A Hora do Rush");
  });

  it("falls back to the generated artwork when the image fails", () => {
    renderCard({ imageUrl: POSTER });

    fireEvent.error(screen.getByRole("img", { name: "A Hora do Rush" }));

    expect(screen.getByRole("img", { name: "A Hora do Rush" }).tagName).not.toBe("IMG");
  });

  it("sets the artwork title, not the card title, when given one", () => {
    renderCard({ title: "Visões Noturnas - S01E11", artworkTitle: "Visões Noturnas", variant: "landscape" });

    const art = screen.getByRole("img", { name: "Visões Noturnas" });
    expect(art).toHaveTextContent("Visões Noturnas");
    expect(art).not.toHaveTextContent("S01E11");
  });
});
