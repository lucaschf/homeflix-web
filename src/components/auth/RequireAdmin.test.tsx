import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../../api/queryClient";
import type { User } from "../../api/types";
import i18n from "../../i18n";
import { AdminOverview } from "../../pages/admin/Overview";
import { theme } from "../../theme";
import { AdminLayout } from "../admin";
import { ParentalPinProvider } from "../parental/ParentalPinProvider";
import { ToastProvider } from "../ToastProvider";
import { RequireAdmin } from "./RequireAdmin";
import { RequireAuth } from "./RequireAuth";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

// The flag is a build-time constant; a getter lets each test pick its value.
const flags = vi.hoisted(() => ({ parentalControls: false }));
vi.mock("../../config/featureFlags", () => ({
  SHARE_ENABLED: true,
  get PARENTAL_CONTROLS_ENABLED() {
    return flags.parentalControls;
  },
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
function renderAdmin(user: User, nextUser: User = user) {
  // ``/users/me`` answers ``user`` until something refetches it.
  let meCalls = 0;
  apiGet.mockImplementation((path: string) => {
    if (path === "/users/me") return Promise.resolve({ data: meCalls++ === 0 ? user : nextUser });
    // Admin data and everything else stays pending: only whether it
    // was requested matters here.
    return new Promise(() => {});
  });
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <ParentalPinProvider>
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
          </ParentalPinProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const adminRequests = () =>
  apiGet.mock.calls.map(([path]) => path as string).filter((path) => path.startsWith("/admin"));

beforeEach(async () => {
  vi.clearAllMocks();
  flags.parentalControls = false;
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

describe("RequireAdmin — unlock from the lock screen", () => {
  const meCalls = () => apiGet.mock.calls.filter(([path]) => path === "/users/me").length;

  it("unlocks with the PIN, refetches the current user and renders the admin shell", async () => {
    flags.parentalControls = true;
    apiPost.mockResolvedValue(undefined);
    renderAdmin(
      { ...BASE_USER, admin_access: "suspended" },
      { ...BASE_USER, admin_access: "granted" },
    );

    await userEvent.click(await screen.findByRole("button", { name: "Unlock with PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
    await userEvent.type(within(dialog).getByLabelText("Parental PIN"), "123456");
    await userEvent.click(within(dialog).getByRole("button", { name: "Unlock" }));

    // The challenge closes only after the ``/users/me`` refetch, and the
    // admin shell stays aria-hidden until the dialog's exit transition ends.
    // Wait for that with a cheap check: a ``findByRole`` here would compute
    // every admin link's accessible name on each DOM mutation, and that jsdom
    // work starves the transition's timer past findBy's 1 s timeout under
    // full-suite load.
    await waitFor(() => expect(dialog).not.toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(apiPost).toHaveBeenCalledWith("/parental/unlock", { pin: "123456" });
    expect(meCalls()).toBe(2);
    expect(screen.queryByText("Admin is locked on this profile")).not.toBeInTheDocument();
  });

  it("stays locked when the challenge is closed", async () => {
    flags.parentalControls = true;
    renderAdmin({ ...BASE_USER, admin_access: "suspended" });

    await userEvent.click(await screen.findByRole("button", { name: "Unlock with PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(screen.getByText("Admin is locked on this profile")).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
    expect(adminRequests()).toEqual([]);
  });

  it("offers no unlock while parental controls are off", async () => {
    renderAdmin({ ...BASE_USER, admin_access: "suspended" });

    expect(await screen.findByText("Admin is locked on this profile")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Unlock with PIN" })).not.toBeInTheDocument();
  });
});

describe("RequireAdmin — lock screen copy", () => {
  const BODY =
    "Admin tools are unavailable while this session is under an age limit. Switch to an unrestricted profile to manage the server.";
  const BODY_WITH_PIN =
    "Admin tools are unavailable while this session is under an age limit. Enter the parental PIN for 5 minutes of admin access on this device, or switch to an unrestricted profile.";

  it("names the PIN as a way out while parental controls are on", async () => {
    flags.parentalControls = true;
    renderAdmin({ ...BASE_USER, admin_access: "suspended" });

    expect(await screen.findByText(BODY_WITH_PIN)).toBeInTheDocument();
    expect(screen.queryByText(BODY)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unlock with PIN" })).toBeInTheDocument();
  });

  it("only points at an unrestricted profile while parental controls are off", async () => {
    renderAdmin({ ...BASE_USER, admin_access: "suspended" });

    expect(await screen.findByText(BODY)).toBeInTheDocument();
    expect(screen.queryByText(BODY_WITH_PIN)).not.toBeInTheDocument();
  });
});
