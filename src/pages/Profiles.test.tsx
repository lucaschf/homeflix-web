import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { createQueryClient } from "../api/queryClient";
import type { Profile, User } from "../api/types";
import { ParentalPinProvider } from "../components/parental/ParentalPinProvider";
import { ToastProvider } from "../components/ToastProvider";
import i18n from "../i18n";
import { theme } from "../theme";
import { Profiles } from "./Profiles";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

// The flag is a build-time constant; a getter lets each test pick its value.
const flags = vi.hoisted(() => ({ parentalControls: true }));
vi.mock("../config/featureFlags", () => ({
  SHARE_ENABLED: true,
  get PARENTAL_CONTROLS_ENABLED() {
    return flags.parentalControls;
  },
}));

const USER: User = {
  id: "usr_1",
  email: "parent@home.test",
  role: "admin",
  is_active: true,
  is_verified: true,
  active_profile_id: "prf_kid",
  parental_pin_configured: true,
};

const profile = (id: string, name: string): Profile => ({
  id,
  user_id: USER.id,
  name,
  avatar_url: null,
  is_kids: false,
  allowed_library_ids: ["lib_movies"],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const PARENT = profile("prf_parent", "Parent");
const KID: Profile = { ...profile("prf_kid", "Kid"), is_kids: true, maturity_limit: 10 };

const PIN_REQUIRED = () =>
  new ApiError(403, "Forbidden", {
    code: "PARENTAL_PIN_REQUIRED",
    type: "business_rule_violation",
    message: "backend text: pin required",
    details: [],
  });

type SwitchAnswer = "ok" | "pin";

/**
 * Stubs the API for a household. ``switchAnswers`` are the successive
 * answers to ``POST /profiles/{id}/switch``; the last one repeats.
 */
function stubApi(profiles: Profile[], switchAnswers: SwitchAnswer[]) {
  apiGet.mockImplementation((path: string) => {
    if (path === "/users/me") return Promise.resolve({ data: USER });
    if (path === "/profiles") return Promise.resolve({ data: profiles });
    return new Promise(() => {});
  });
  let switches = 0;
  apiPost.mockImplementation((path: string) => {
    if (path === "/parental/unlock") return Promise.resolve(undefined);
    if (path.endsWith("/switch")) {
      const answer = switchAnswers[Math.min(switches++, switchAnswers.length - 1)];
      return answer === "ok" ? Promise.resolve(undefined) : Promise.reject(PIN_REQUIRED());
    }
    return new Promise(() => {});
  });
}

function renderPicker() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <ParentalPinProvider>
            <MemoryRouter initialEntries={["/profiles"]}>
              <Routes>
                <Route path="/profiles" element={<Profiles />} />
                <Route path="/" element={<p>Catalog home</p>} />
              </Routes>
            </MemoryRouter>
          </ParentalPinProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

const switchCalls = (id: string) =>
  apiPost.mock.calls.filter(([path]) => path === `/profiles/${id}/switch`);
const unlockCalls = () => apiPost.mock.calls.filter(([path]) => path === "/parental/unlock");
const challenge = () => screen.queryByRole("dialog", { name: "Parental PIN required" });

async function enterPin(pin = "123456") {
  const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
  await userEvent.type(within(dialog).getByLabelText("Parental PIN"), pin);
  await userEvent.click(within(dialog).getByRole("button", { name: "Unlock" }));
}

async function pick(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: `Sign in as ${name}` }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  flags.parentalControls = true;
  await i18n.changeLanguage("en");
});

describe("Profiles — switch behind the parental PIN", () => {
  it("challenges a refused switch, unlocks, re-sends the switch once and enters the catalog", async () => {
    stubApi([PARENT, KID], ["pin", "ok"]);
    renderPicker();

    await pick("Parent");
    expect(switchCalls(PARENT.id)).toHaveLength(1);
    await enterPin("135790");

    expect(await screen.findByText("Catalog home")).toBeInTheDocument();
    expect(unlockCalls()).toEqual([["/parental/unlock", { pin: "135790" }]]);
    expect(switchCalls(PARENT.id)).toHaveLength(2);
    // Unlock first, then the retried switch.
    const order = apiPost.mock.calls.map(([path]) => path);
    expect(order).toEqual([
      "/profiles/prf_parent/switch",
      "/parental/unlock",
      "/profiles/prf_parent/switch",
    ]);
    // ``run`` owned the refusal: the global handler for unguarded writes
    // stayed out, so nobody is told to repeat what already happened.
    expect(screen.queryByText(/Repeat the action/)).not.toBeInTheDocument();
  });

  it("reports a retry refused again and does not reopen the challenge", async () => {
    stubApi([PARENT, KID], ["pin"]);
    renderPicker();

    await pick("Parent");
    await enterPin();

    expect(await screen.findByText("This needs the parental PIN. Try again.")).toBeInTheDocument();
    await waitFor(() => expect(challenge()).not.toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(challenge()).not.toBeInTheDocument();
    expect(switchCalls(PARENT.id)).toHaveLength(2);
    expect(unlockCalls()).toHaveLength(1);
    expect(screen.queryByText("Catalog home")).not.toBeInTheDocument();
    expect(screen.queryByText(/backend text/)).not.toBeInTheDocument();
  });

  it("does not retry when the challenge is cancelled, and stays on the picker", async () => {
    stubApi([PARENT, KID], ["pin", "ok"]);
    renderPicker();

    await pick("Parent");
    const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(challenge()).not.toBeInTheDocument());
    expect(switchCalls(PARENT.id)).toHaveLength(1);
    expect(unlockCalls()).toEqual([]);
    expect(screen.getByRole("button", { name: "Sign in as Parent" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Catalog home")).not.toBeInTheDocument();
  });
});

describe("Profiles — one-profile auto-skip", () => {
  it("enters the catalog directly when the switch is allowed", async () => {
    stubApi([KID], ["ok"]);
    renderPicker();

    expect(await screen.findByText("Catalog home")).toBeInTheDocument();
    expect(switchCalls(KID.id)).toHaveLength(1);
  });

  it("shows the challenge on a refused switch, and the picker once it is closed", async () => {
    stubApi([PARENT], ["pin"]);
    renderPicker();

    const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    expect(await screen.findByRole("button", { name: "Sign in as Parent" })).toBeInTheDocument();
    expect(screen.getByText("Who's watching?")).toBeInTheDocument();
    expect(switchCalls(PARENT.id)).toHaveLength(1);
  });

  it("shows the picker with the error when the retried switch is refused again", async () => {
    stubApi([PARENT], ["pin"]);
    renderPicker();

    await enterPin();

    expect(await screen.findByText("This needs the parental PIN. Try again.")).toBeInTheDocument();
    // Accessible again once the closing challenge stops hiding the page.
    expect(await screen.findByRole("button", { name: "Sign in as Parent" })).toBeInTheDocument();
    expect(switchCalls(PARENT.id)).toHaveLength(2);
  });
});

describe("Profiles — parental controls flag off", () => {
  beforeEach(() => {
    flags.parentalControls = false;
  });

  it("reports a refused switch without opening a challenge", async () => {
    stubApi([PARENT, KID], ["pin"]);
    renderPicker();

    await pick("Parent");

    expect(await screen.findByText("This needs the parental PIN. Try again.")).toBeInTheDocument();
    expect(challenge()).not.toBeInTheDocument();
    expect(switchCalls(PARENT.id)).toHaveLength(1);
    expect(unlockCalls()).toEqual([]);
  });
});
