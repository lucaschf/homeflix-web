import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authKeys } from "../api/auth";
import { createQueryClient } from "../api/queryClient";
import type { User } from "../api/types";
import i18n from "../i18n";
import { theme } from "../theme";
import { Navbar } from "./Navbar";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

const BASE_USER: User = {
  id: "usr_1",
  email: "parent@home.test",
  role: "admin",
  is_active: true,
  is_verified: true,
  active_profile_id: "prf_kid",
};

/** Renders the navbar over a cached ``/users/me``, so no fetch races the assertion. */
function renderNavbar(user: User) {
  apiGet.mockImplementation(() => new Promise(() => {}));
  const client = createQueryClient();
  client.setQueryData(authKeys.currentUser, user);
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <MemoryRouter initialEntries={["/"]}>
          <Navbar />
        </MemoryRouter>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});

describe("Navbar — admin entry", () => {
  it("shows the admin link to a granted admin", () => {
    renderNavbar({ ...BASE_USER, admin_access: "granted" });

    expect(screen.getByRole("link", { name: "Admin" })).toHaveAttribute("href", "/admin");
  });

  it("hides the admin link from a suspended admin", () => {
    renderNavbar({ ...BASE_USER, admin_access: "suspended" });

    expect(screen.getByRole("link", { name: "Home" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Admin" })).not.toBeInTheDocument();
  });

  it("falls back to the admin role when admin_access is absent", () => {
    renderNavbar(BASE_USER);

    expect(screen.getByRole("link", { name: "Admin" })).toBeInTheDocument();
  });
});
