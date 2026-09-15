import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import type { User } from "../../api/types";
import i18n from "../../i18n";
import { AdminOverview } from "../../pages/admin/Overview";
import { theme } from "../../theme";
import { AdminLayout } from "../admin";
import { ToastProvider } from "../ToastProvider";
import { RequireAdmin } from "./RequireAdmin";
import { RequireAuth } from "./RequireAuth";

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
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

/** Mounts ``/admin`` exactly as ``App.tsx`` nests it. */
function renderAdmin(user: User) {
  apiGet.mockImplementation((path: string) => {
    if (path === "/users/me") return Promise.resolve({ data: user });
    // Admin data and everything else stays pending: only whether it
    // was requested matters here.
    return new Promise(() => {});
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <MemoryRouter initialEntries={["/admin"]}>
            <Routes>
              <Route element={<RequireAuth />}>
                <Route path="/" element={<p>Catalog home</p>} />
                <Route element={<RequireAdmin />}>
                  <Route element={<AdminLayout />}>
                    <Route path="/admin" element={<AdminOverview />} />
                  </Route>
                </Route>
              </Route>
            </Routes>
          </MemoryRouter>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const adminRequests = () =>
  apiGet.mock.calls.map(([path]) => path as string).filter((path) => path.startsWith("/admin"));

beforeEach(async () => {
  vi.clearAllMocks();
  await i18n.changeLanguage("en");
});

describe("RequireAdmin — admin_access", () => {
  it("shows the lock screen for a suspended admin without mounting the admin shell", async () => {
    renderAdmin({ ...BASE_USER, admin_access: "suspended" });

    expect(await screen.findByText("Admin is locked on this profile")).toBeInTheDocument();
    expect(adminRequests()).toEqual([]);
    expect(screen.queryByRole("link", { name: "Overview" })).not.toBeInTheDocument();
  });

  it("renders the admin shell for a granted admin", async () => {
    renderAdmin({ ...BASE_USER, admin_access: "granted" });

    expect(await screen.findByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(adminRequests()).not.toEqual([]);
    expect(screen.queryByText("Admin is locked on this profile")).not.toBeInTheDocument();
  });

  it("falls back to the admin role when admin_access is absent", async () => {
    renderAdmin(BASE_USER);

    expect(await screen.findByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(adminRequests()).not.toEqual([]);
  });

  it("sends a member without admin_access to the catalog", async () => {
    renderAdmin({ ...BASE_USER, role: "member" });

    expect(await screen.findByText("Catalog home")).toBeInTheDocument();
    expect(adminRequests()).toEqual([]);
  });

  it("sends a session with admin_access none to the catalog", async () => {
    renderAdmin({ ...BASE_USER, role: "member", admin_access: "none" });

    expect(await screen.findByText("Catalog home")).toBeInTheDocument();
    expect(adminRequests()).toEqual([]);
  });
});
