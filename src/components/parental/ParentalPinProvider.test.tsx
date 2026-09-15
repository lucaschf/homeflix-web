import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../../api/client";
import { useJobs } from "../../api/hooks";
import { createQueryClient } from "../../api/queryClient";
import i18n from "../../i18n";
import { UsersAdmin } from "../../pages/admin/UsersAdmin";
import { theme } from "../../theme";
import { ToastProvider } from "../ToastProvider";
import { ParentalPinProvider } from "./ParentalPinProvider";
import { isParentalChallengeCancelled, useParentalUnlock } from "./useParentalUnlock";

const { apiGet, apiPost } = vi.hoisted(() => ({ apiGet: vi.fn(), apiPost: vi.fn() }));

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../api/client")>()),
  api: { get: apiGet, post: apiPost, put: vi.fn(), patch: vi.fn(), del: vi.fn() },
}));

// The flag is a build-time constant; a getter lets each test pick its value.
const flags = vi.hoisted(() => ({ parentalControls: true }));
vi.mock("../../config/featureFlags", () => ({
  SHARE_ENABLED: true,
  get PARENTAL_CONTROLS_ENABLED() {
    return flags.parentalControls;
  },
}));

const gateError = (code: string, status = 403) =>
  new ApiError(status, "", { code, type: "business_rule_violation", message: code, details: [] });

const PIN_REQUIRED = () => gateError("PARENTAL_PIN_REQUIRED");

/** What a ``run`` call ended with, for the probe to render. */
type Outcome = { kind: "resolved"; value: string } | { kind: "cancelled" } | { kind: "rejected"; code?: string };

/** Calls ``run(fn)`` from a button and records the outcome. */
function RunProbe({ fn, onOutcome }: { fn: () => Promise<string>; onOutcome: (o: Outcome) => void }) {
  const { run } = useParentalUnlock();
  return (
    <button
      type="button"
      onClick={() =>
        run(fn).then(
          (value) => onOutcome({ kind: "resolved", value }),
          (err: unknown) =>
            onOutcome(
              isParentalChallengeCancelled(err)
                ? { kind: "cancelled" }
                : { kind: "rejected", code: (err as ApiError).body?.code },
            ),
        )
      }
    >
      Go
    </button>
  );
}

/** Polls an admin read the way the jobs dashboard does. */
function JobsProbe() {
  const { isError } = useJobs();
  return <p>{isError ? "jobs failed" : "jobs loading"}</p>;
}

function renderWithProvider(ui: ReactNode) {
  const client = createQueryClient();
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <ParentalPinProvider>
            <MemoryRouter>{ui}</MemoryRouter>
          </ParentalPinProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return client;
}

function renderRun(fn: () => Promise<string>) {
  const outcomes: Outcome[] = [];
  renderWithProvider(<RunProbe fn={fn} onOutcome={(o) => outcomes.push(o)} />);
  return outcomes;
}

const unlockCalls = () => apiPost.mock.calls.filter(([path]) => path === "/parental/unlock");

async function enterPin(pin = "123456") {
  const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
  await userEvent.type(within(dialog).getByLabelText("Parental PIN"), pin);
  await userEvent.click(within(dialog).getByRole("button", { name: "Unlock" }));
}

beforeEach(async () => {
  vi.clearAllMocks();
  flags.parentalControls = true;
  await i18n.changeLanguage("en");
  apiGet.mockImplementation(() => new Promise(() => {}));
  apiPost.mockImplementation((path: string) =>
    path === "/parental/unlock" ? Promise.resolve(undefined) : new Promise(() => {}),
  );
});

describe("useParentalUnlock().run", () => {
  it("resolves without a challenge when fn succeeds", async () => {
    const fn = vi.fn().mockResolvedValue("ok");
    const outcomes = renderRun(fn);

    await userEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(outcomes).toEqual([{ kind: "resolved", value: "ok" }]));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("passes any other error through without a challenge", async () => {
    const fn = vi.fn().mockRejectedValue(gateError("CANNOT_DELETE_LAST_PROFILE", 409));
    const outcomes = renderRun(fn);

    await userEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() =>
      expect(outcomes).toEqual([{ kind: "rejected", code: "CANNOT_DELETE_LAST_PROFILE" }]),
    );
    expect(fn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("challenges on PARENTAL_PIN_REQUIRED, unlocks, then runs fn exactly once more", async () => {
    const fn = vi.fn().mockRejectedValueOnce(PIN_REQUIRED()).mockResolvedValue("switched");
    const outcomes = renderRun(fn);

    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(fn).toHaveBeenCalledTimes(1);
    await enterPin("123456");

    await waitFor(() => expect(outcomes).toEqual([{ kind: "resolved", value: "switched" }]));
    expect(unlockCalls()).toEqual([["/parental/unlock", { pin: "123456" }]]);
    expect(fn).toHaveBeenCalledTimes(2);
    // The retry happened after the unlock, not alongside it.
    expect(apiPost.mock.invocationCallOrder[0]).toBeLessThan(fn.mock.invocationCallOrder[1]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rejects a retry refused again without reopening the challenge", async () => {
    const fn = vi.fn().mockRejectedValue(PIN_REQUIRED());
    const outcomes = renderRun(fn);

    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    await enterPin();

    await waitFor(() => expect(outcomes).toEqual([{ kind: "rejected", code: "PARENTAL_PIN_REQUIRED" }]));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(unlockCalls()).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("rejects as cancelled, without retrying, when the challenge is closed", async () => {
    const fn = vi.fn().mockRejectedValue(PIN_REQUIRED());
    const outcomes = renderRun(fn);

    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(outcomes).toEqual([{ kind: "cancelled" }]));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(unlockCalls()).toEqual([]);
  });
});

describe("parental controls flag off", () => {
  beforeEach(() => {
    flags.parentalControls = false;
  });

  it("run passes PARENTAL_PIN_REQUIRED through and opens no challenge", async () => {
    const fn = vi.fn().mockRejectedValue(PIN_REQUIRED());
    const outcomes = renderRun(fn);

    await userEvent.click(screen.getByRole("button", { name: "Go" }));

    await waitFor(() => expect(outcomes).toEqual([{ kind: "rejected", code: "PARENTAL_PIN_REQUIRED" }]));
    expect(fn).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens no challenge for an unguarded write refused with PARENTAL_PIN_REQUIRED", async () => {
    apiGet.mockResolvedValue({ data: [] });
    apiPost.mockRejectedValue(PIN_REQUIRED());
    renderWithProvider(<UsersAdmin />);

    await inviteUser();

    expect(await screen.findByText("PARENTAL_PIN_REQUIRED")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Parental PIN required" })).not.toBeInTheDocument();
    expect(adminUserPosts()).toHaveLength(1);
  });
});

const adminUserPosts = () => apiPost.mock.calls.filter(([path]) => path === "/admin/users");

/** Opens the invite dialog on the users page and submits a new member. */
async function inviteUser() {
  await userEvent.click(await screen.findByRole("button", { name: "Invite user" }));
  const invite = await screen.findByRole("dialog");
  await userEvent.type(invite.querySelector('input[type="email"]')!, "kid@home.test");
  await userEvent.type(invite.querySelector('input[type="password"]')!, "known-password");
  await userEvent.click(within(invite).getByRole("button", { name: "Create user" }));
}

describe("admin writes (D10)", () => {
  it("challenges an unguarded admin write, then asks to repeat it without re-sending", async () => {
    apiGet.mockResolvedValue({ data: [] });
    apiPost.mockImplementation((path: string) =>
      path === "/parental/unlock" ? Promise.resolve(undefined) : Promise.reject(PIN_REQUIRED()),
    );
    renderWithProvider(<UsersAdmin />);

    await inviteUser();
    await enterPin("246810");

    expect(
      await screen.findByText("Unlocked for 5 minutes on this device. Repeat the action."),
    ).toBeInTheDocument();
    expect(unlockCalls()).toEqual([["/parental/unlock", { pin: "246810" }]]);
    expect(adminUserPosts()).toHaveLength(1);
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Parental PIN required" })).not.toBeInTheDocument(),
    );
    // Give a replay every chance to show up before the final count.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(adminUserPosts()).toHaveLength(1);
  });

  it("closing the challenge after an admin write shows no repeat prompt", async () => {
    apiGet.mockResolvedValue({ data: [] });
    apiPost.mockRejectedValue(PIN_REQUIRED());
    renderWithProvider(<UsersAdmin />);

    await inviteUser();
    const challenge = await screen.findByRole("dialog", { name: "Parental PIN required" });
    await userEvent.click(within(challenge).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Parental PIN required" })).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/Repeat the action/)).not.toBeInTheDocument();
    expect(adminUserPosts()).toHaveLength(1);
    expect(unlockCalls()).toEqual([]);
  });

  it("opens no challenge when a polled admin read is refused with PARENTAL_PIN_REQUIRED", async () => {
    apiGet.mockImplementation((path: string) =>
      path === "/admin/jobs" ? Promise.reject(PIN_REQUIRED()) : new Promise(() => {}),
    );
    renderWithProvider(<JobsProbe />);

    expect(await screen.findByText("jobs failed")).toBeInTheDocument();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(unlockCalls()).toEqual([]);
  });
});
