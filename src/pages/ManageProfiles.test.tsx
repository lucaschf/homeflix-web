import { ThemeProvider } from "@mui/material";
import { type QueryKey, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../api/client";
import { createQueryClient } from "../api/queryClient";
import type { Library, Profile, User } from "../api/types";
import { RequireAuth } from "../components/auth";
import { ParentalPinProvider } from "../components/parental/ParentalPinProvider";
import { ToastProvider } from "../components/ToastProvider";
import i18n from "../i18n";
import { theme } from "../theme";
import { ManageProfiles } from "./ManageProfiles";

const { apiGet, apiPost, apiPut, apiDel } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDel: vi.fn(),
}));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: apiPost, put: apiPut, patch: vi.fn(), del: apiDel },
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
  active_profile_id: "prf_alice",
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

const ALICE = profile("prf_alice", "Alice");
const BOB = profile("prf_bob", "Bob");
const KID: Profile = { ...profile("prf_kid", "Kid"), is_kids: true, maturity_limit: 14 };

const LIBRARIES = [
  { id: "lib_movies", name: "Movies", paths: ["/media/movies"] },
  { id: "lib_shows", name: "Shows", paths: ["/media/shows"] },
] as Library[];

/** Profile-scoped data a catalog session leaves in the cache. */
const PROFILE_SCOPED_KEYS: QueryKey[] = [
  ["catalog", "recently-added", "en", 20],
  ["continueWatching", "en"],
  ["watchlist", "en"],
  ["customLists"],
];

function stubApi() {
  apiGet.mockImplementation((path: string) => {
    if (path === "/users/me") return Promise.resolve({ data: USER });
    if (path === "/profiles") return Promise.resolve({ data: [ALICE, BOB, KID] });
    if (path === "/libraries") return Promise.resolve({ data: LIBRARIES });
    return new Promise(() => {});
  });
  apiPut.mockImplementation((path: string, body: Partial<Profile>) => {
    const target = [ALICE, BOB, KID].find((p) => path.endsWith(p.id))!;
    return Promise.resolve({ data: { ...target, ...body } });
  });
  apiPost.mockImplementation((_path: string, body: Partial<Profile>) =>
    Promise.resolve({ data: { ...profile("prf_new", "New"), ...body } }),
  );
  apiDel.mockResolvedValue(undefined);
}

/** Render the screen behind the real auth guard, over a warm cache. */
function renderManage() {
  const client = createQueryClient();
  for (const key of PROFILE_SCOPED_KEYS) client.setQueryData(key, { cached: true });
  const removed: QueryKey[] = [];
  client.getQueryCache().subscribe((event) => {
    if (event.type === "removed") removed.push(event.query.queryKey);
  });
  render(
    <QueryClientProvider client={client}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <ParentalPinProvider>
            <MemoryRouter initialEntries={["/profiles/manage"]}>
              <Routes>
                <Route element={<RequireAuth />}>
                  <Route path="/profiles/manage" element={<ManageProfiles />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ParentalPinProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
  return { removed };
}

const callsTo = (path: string) => apiGet.mock.calls.filter(([p]) => p === path).length;

/** Open a profile's edit dialog from its tile. */
async function openEdit(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: new RegExp(name) }));
  return screen.findByRole("dialog");
}

/** Wait for the mutation's cache work: both branches refetch the list. */
async function settled() {
  await waitFor(() => expect(callsTo("/profiles")).toBe(2));
}

beforeEach(async () => {
  vi.clearAllMocks();
  flags.parentalControls = true;
  await i18n.changeLanguage("en");
  stubApi();
});

describe("ManageProfiles — profile-scoped cache", () => {
  it("drops profile-scoped queries, libraries included, when the active profile's libraries change", async () => {
    const { removed } = renderManage();

    await openEdit("Alice");
    await userEvent.click(screen.getByRole("checkbox", { name: /Shows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await settled();

    expect(apiPut).toHaveBeenCalledWith(
      "/profiles/prf_alice",
      expect.objectContaining({ allowed_library_ids: ["lib_movies", "lib_shows"] }),
    );
    for (const key of [...PROFILE_SCOPED_KEYS, ["libraries"]]) {
      expect(removed).toContainEqual(key);
    }
    // The auth slice is refetched, never dropped.
    expect(removed.filter((key) => key[0] === "auth")).toEqual([]);
    expect(callsTo("/users/me")).toBe(2);
  });

  it("keeps the cache when another profile's libraries change", async () => {
    const { removed } = renderManage();

    await openEdit("Bob");
    await userEvent.click(screen.getByRole("checkbox", { name: /Shows/ }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await settled();

    expect(apiPut).toHaveBeenCalledWith(
      "/profiles/prf_bob",
      expect.objectContaining({ allowed_library_ids: ["lib_movies", "lib_shows"] }),
    );
    expect(removed).toEqual([]);
  });

  it("keeps the cache when the active profile is only renamed", async () => {
    const { removed } = renderManage();

    await openEdit("Alice");
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Alicia");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await settled();

    expect(apiPut).toHaveBeenCalledWith(
      "/profiles/prf_alice",
      expect.objectContaining({ name: "Alicia" }),
    );
    expect(removed).toEqual([]);
  });

  it("drops profile-scoped queries when the active profile is deleted", async () => {
    const { removed } = renderManage();

    await openEdit("Alice");
    await userEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await settled();

    expect(apiDel).toHaveBeenCalledWith("/profiles/prf_alice");
    for (const key of [...PROFILE_SCOPED_KEYS, ["libraries"]]) {
      expect(removed).toContainEqual(key);
    }
  });

  it("keeps the cache when another profile is deleted", async () => {
    const { removed } = renderManage();

    await openEdit("Bob");
    await userEvent.click(screen.getByRole("button", { name: "Delete profile" }));
    await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
    await settled();

    expect(apiDel).toHaveBeenCalledWith("/profiles/prf_bob");
    expect(removed).toEqual([]);
  });

  it("drops profile-scoped queries when only the active profile's maturity limit changes", async () => {
    // The form sends no limit; the server's answer is what moves it:
    // same name and libraries, a limit where there was none.
    apiPut.mockImplementation((_path: string, body: Partial<Profile>) =>
      Promise.resolve({ data: { ...ALICE, ...body, maturity_limit: 12 } }),
    );
    const { removed } = renderManage();

    await openEdit("Alice");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await settled();

    expect(apiPut).toHaveBeenCalledWith(
      "/profiles/prf_alice",
      expect.objectContaining({ name: "Alice", allowed_library_ids: ["lib_movies"] }),
    );
    for (const key of [...PROFILE_SCOPED_KEYS, ["libraries"]]) {
      expect(removed).toContainEqual(key);
    }
  });
});

/** The object ``client.ts`` puts on the wire: ``JSON.stringify`` of the body. */
const wire = (body: unknown) => JSON.parse(JSON.stringify(body)) as Record<string, unknown>;

async function save() {
  await userEvent.click(screen.getByRole("button", { name: "Save" }));
  await settled();
  expect(apiPut).toHaveBeenCalledTimes(1);
  return apiPut.mock.calls[0];
}

async function createNamed(name: string) {
  await userEvent.click(await screen.findByRole("button", { name: "New profile" }));
  await userEvent.type(await screen.findByLabelText("Name"), name);
}

describe("ManageProfiles — maturity limit payload", () => {
  it("renames a limited profile without sending is_kids or maturity_limit", async () => {
    renderManage();

    await openEdit("Kid");
    const name = screen.getByLabelText("Name");
    await userEvent.clear(name);
    await userEvent.type(name, "Kiddo");
    const [path, body] = await save();

    expect(path).toBe("/profiles/prf_kid");
    expect(wire(body)).toEqual({ name: "Kiddo", allowed_library_ids: ["lib_movies"] });
  });

  it("changes a limited profile's libraries without sending maturity_limit", async () => {
    renderManage();

    await openEdit("Kid");
    await userEvent.click(screen.getByRole("checkbox", { name: /Shows/ }));
    const [, body] = await save();

    expect(wire(body)).toEqual({
      name: "Kid",
      allowed_library_ids: ["lib_movies", "lib_shows"],
    });
  });

  it("sends an explicit null, kept by JSON serialization, when Unrestricted is chosen", async () => {
    renderManage();

    await openEdit("Kid");
    await userEvent.click(screen.getByRole("radio", { name: "Unrestricted" }));
    const [, body] = await save();

    expect(JSON.stringify(body)).toContain('"maturity_limit":null');
    expect(wire(body)).toEqual({
      name: "Kid",
      allowed_library_ids: ["lib_movies"],
      maturity_limit: null,
    });
  });

  it("sends the chosen step when the limit changes", async () => {
    renderManage();

    await openEdit("Kid");
    await userEvent.click(screen.getByRole("radio", { name: "All ages" }));
    const [, body] = await save();

    expect(wire(body)).toHaveProperty("maturity_limit", 0);
  });

  it("creates a profile with the chosen limit", async () => {
    renderManage();

    await createNamed("Teen");
    await userEvent.click(screen.getByRole("radio", { name: "Up to age 16" }));
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await settled();

    expect(apiPost).toHaveBeenCalledTimes(1);
    const [path, body] = apiPost.mock.calls[0];
    expect(path).toBe("/profiles");
    expect(wire(body)).toEqual({ name: "Teen", allowed_library_ids: [], maturity_limit: 16 });
  });
});

describe("ManageProfiles — parental controls flag off", () => {
  beforeEach(() => {
    flags.parentalControls = false;
  });

  it("edits a limited profile with no selector and no maturity_limit", async () => {
    renderManage();

    const dialog = await openEdit("Kid");
    expect(within(dialog).queryByRole("radio")).not.toBeInTheDocument();
    const [, body] = await save();

    expect(wire(body)).toEqual({ name: "Kid", allowed_library_ids: ["lib_movies"] });
  });

  it("creates a profile with no maturity_limit", async () => {
    renderManage();

    await createNamed("Teen");
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await settled();

    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(wire(apiPost.mock.calls[0][1])).toEqual({ name: "Teen", allowed_library_ids: [] });
  });

  it("renders no PIN setup UI", async () => {
    withPinConfigured(true);
    renderManage();

    expect(await screen.findByRole("button", { name: /Alice/ })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Parental PIN" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /PIN/ })).not.toBeInTheDocument();
  });

  it("reports a save refused with PARENTAL_PIN_REQUIRED without opening a challenge", async () => {
    apiPut.mockRejectedValue(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await openEdit("Bob");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByText("This needs the parental PIN. Try again.")).toBeInTheDocument();
    expect(challenge()).not.toBeInTheDocument();
    expect(apiPut).toHaveBeenCalledTimes(1);
  });
});

/** A structured backend error whose message the UI must never show. */
function backendError(status: number, code: string) {
  return new ApiError(status, "", {
    code,
    type: "error",
    message: `backend text for ${code}`,
    details: [],
  });
}

const challenge = () => screen.queryByRole("dialog", { name: "Parental PIN required" });

async function enterPin(pin = "123456") {
  const dialog = await screen.findByRole("dialog", { name: "Parental PIN required" });
  await userEvent.type(within(dialog).getByLabelText("Parental PIN"), pin);
  await userEvent.click(within(dialog).getByRole("button", { name: "Unlock" }));
}

async function deleteFromEdit(name: string) {
  await openEdit(name);
  await userEvent.click(screen.getByRole("button", { name: "Delete profile" }));
  await userEvent.click(await screen.findByRole("button", { name: "Delete" }));
}

const unlockCalls = () => apiPost.mock.calls.filter(([path]) => path === "/parental/unlock");

/** Serves ``/users/me`` with the given PIN state; everything else as ``stubApi``. */
function withPinConfigured(configured: boolean) {
  const base = apiGet.getMockImplementation()!;
  apiGet.mockImplementation((path: string) =>
    path === "/users/me"
      ? Promise.resolve({ data: { ...USER, parental_pin_configured: configured } })
      : base(path),
  );
}

const pinSection = () => screen.findByRole("region", { name: "Parental PIN" });

describe("ManageProfiles — parental PIN challenge", () => {
  it("challenges a refused update and sends it once more after the unlock", async () => {
    apiPost.mockResolvedValue(undefined);
    apiPut.mockRejectedValueOnce(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await openEdit("Kid");
    await userEvent.click(screen.getByRole("radio", { name: "Unrestricted" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await enterPin("112233");

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(2));
    expect(unlockCalls()).toEqual([["/parental/unlock", { pin: "112233" }]]);
    expect(apiPut.mock.calls[1]).toEqual(apiPut.mock.calls[0]);
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("challenges a refused delete and sends it once more after the unlock", async () => {
    apiPost.mockResolvedValue(undefined);
    apiDel.mockRejectedValueOnce(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await deleteFromEdit("Kid");
    await enterPin();

    await waitFor(() => expect(apiDel).toHaveBeenCalledTimes(2));
    expect(apiDel.mock.calls).toEqual([["/profiles/prf_kid"], ["/profiles/prf_kid"]]);
    expect(unlockCalls()).toHaveLength(1);
  });

  // ``run`` owns the challenge and the retry of these three mutations. Were
  // the query client's handler for unguarded writes to react as well, it
  // would join the challenge and, after the retry already went through,
  // tell the user to repeat an action that happened.

  /** The retried write went through: one challenge, closed, and no repeat prompt. */
  async function expectHandledOnlyByRun() {
    await waitFor(() => expect(challenge()).not.toBeInTheDocument());
    expect(unlockCalls()).toHaveLength(1);
    // Give a late toast every chance to show up before the final check.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(screen.queryByText(/Repeat the action/)).not.toBeInTheDocument();
    expect(challenge()).not.toBeInTheDocument();
    expect(unlockCalls()).toHaveLength(1);
  }

  it("asks nobody to repeat an update that run already retried", async () => {
    apiPost.mockResolvedValue(undefined);
    apiPut.mockRejectedValueOnce(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await openEdit("Kid");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await enterPin();

    await waitFor(() => expect(apiPut).toHaveBeenCalledTimes(2));
    await expectHandledOnlyByRun();
  });

  it("asks nobody to repeat a create that run already retried", async () => {
    apiPost.mockRejectedValueOnce(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await createNamed("Teen");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    await enterPin();

    await waitFor(() =>
      expect(apiPost.mock.calls.filter(([path]) => path === "/profiles")).toHaveLength(2),
    );
    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "New profile" })).not.toBeInTheDocument(),
    );
    await expectHandledOnlyByRun();
  });

  it("asks nobody to repeat a delete that run already retried", async () => {
    apiPost.mockResolvedValue(undefined);
    apiDel.mockRejectedValueOnce(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await deleteFromEdit("Kid");
    await enterPin();

    await waitFor(() => expect(apiDel).toHaveBeenCalledTimes(2));
    await expectHandledOnlyByRun();
  });

  it("keeps the form open, without an error or a retry, when the challenge is cancelled", async () => {
    apiPost.mockRejectedValueOnce(backendError(403, "PARENTAL_PIN_REQUIRED"));
    renderManage();

    await createNamed("Teen");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));
    const pin = await screen.findByRole("dialog", { name: "Parental PIN required" });
    await userEvent.click(within(pin).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(challenge()).not.toBeInTheDocument());
    expect(apiPost).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("dialog", { name: "New profile" })).toBeInTheDocument();
    expect(screen.queryByText("Couldn't save the profile. Try again.")).not.toBeInTheDocument();
  });
});

describe("ManageProfiles — errors by code", () => {
  it("keeps the last-profile message on 409 CANNOT_DELETE_LAST_PROFILE", async () => {
    apiDel.mockRejectedValue(backendError(409, "CANNOT_DELETE_LAST_PROFILE"));
    renderManage();

    await deleteFromEdit("Alice");

    expect(
      await screen.findByText(
        "You must have at least one active profile. Create another one before deleting this.",
      ),
    ).toBeInTheDocument();
    expect(challenge()).not.toBeInTheDocument();
    expect(apiDel).toHaveBeenCalledTimes(1);
  });

  it("points at the PIN setup on 409 PARENTAL_PIN_NOT_CONFIGURED when saving a limit", async () => {
    apiPut.mockRejectedValue(backendError(409, "PARENTAL_PIN_NOT_CONFIGURED"));
    renderManage();

    await openEdit("Bob");
    await userEvent.click(screen.getByRole("radio", { name: "Up to age 12" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "Set a parental PIN before giving a profile an age limit. Set it in the Parental PIN section below first, then set the limit.",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText(/backend text/)).not.toBeInTheDocument();
    expect(challenge()).not.toBeInTheDocument();
  });

  it("explains a 409 DOMAIN_CONFLICT on save", async () => {
    apiPut.mockRejectedValue(backendError(409, "DOMAIN_CONFLICT"));
    renderManage();

    await openEdit("Kid");
    await userEvent.click(screen.getByRole("radio", { name: "Up to age 16" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(
      await screen.findByText(
        "This profile was changed at the same time on another device. Close the form and try again.",
      ),
    ).toBeInTheDocument();
  });
});

describe("ManageProfiles — parental PIN setup", () => {
  it("offers to set a PIN when the account has none", async () => {
    withPinConfigured(false);
    renderManage();

    const section = await pinSection();
    expect(
      within(section).getByText("No parental PIN yet. Set one before giving a profile an age limit."),
    ).toBeInTheDocument();
    expect(within(section).getByRole("button", { name: "Set PIN" })).toBeInTheDocument();
    expect(within(section).queryByRole("button", { name: "Remove PIN" })).not.toBeInTheDocument();
  });

  it("sets the PIN with the account password, telling to type it away from the child", async () => {
    withPinConfigured(false);
    apiPut.mockResolvedValue(undefined);
    renderManage();

    await userEvent.click(within(await pinSection()).getByRole("button", { name: "Set PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Set the parental PIN" });
    expect(
      within(dialog).getByText(
        "Type your account password away from the child. Anyone who knows it can change or remove the PIN.",
      ),
    ).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Account password"), "s3cret-pass");
    await userEvent.type(within(dialog).getByLabelText("New 6-digit PIN"), "987654");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save PIN" }));

    await waitFor(() => expect(callsTo("/users/me")).toBe(2));
    expect(apiPut).toHaveBeenCalledWith("/parental/pin", {
      current_password: "s3cret-pass",
      pin: "987654",
    });
    expect(await screen.findByText("Parental PIN saved.")).toBeInTheDocument();
  });

  it("keeps the new PIN away from password managers and sanitizes it to six ASCII digits", async () => {
    withPinConfigured(true);
    renderManage();

    await userEvent.click(within(await pinSection()).getByRole("button", { name: "Change PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Change the parental PIN" });

    // A new-password field next to the account password reads as a
    // change-password form: the browser would offer to replace the saved
    // login with the PIN.
    expect(dialog.querySelector('[autocomplete="new-password"]')).toBeNull();
    const password = within(dialog).getByLabelText("Account password");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");

    const pin = within(dialog).getByLabelText("New 6-digit PIN") as HTMLInputElement;
    expect(pin).not.toHaveAttribute("type", "password");
    expect(pin).toHaveAttribute("inputmode", "numeric");
    expect(pin).toHaveAttribute("autocomplete", "off");
    expect(pin).toHaveAttribute("data-1p-ignore");
    expect(pin).toHaveAttribute("data-lpignore", "true");
    expect(pin).toHaveAttribute("data-bwignore");
    expect(pin).toHaveAttribute("data-form-type", "other");

    await userEvent.type(pin, "12ab٣٤3456789");
    expect(pin.value).toBe("123456");
  });

  it("shows the wrong-password copy on 403 ACCOUNT_PASSWORD_INVALID", async () => {
    withPinConfigured(false);
    apiPut.mockRejectedValue(backendError(403, "ACCOUNT_PASSWORD_INVALID"));
    renderManage();

    await userEvent.click(within(await pinSection()).getByRole("button", { name: "Set PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Set the parental PIN" });
    await userEvent.type(within(dialog).getByLabelText("Account password"), "wrong");
    await userEvent.type(within(dialog).getByLabelText("New 6-digit PIN"), "987654");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save PIN" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Wrong account password.");
    expect(screen.queryByText(/backend text/)).not.toBeInTheDocument();
    expect((within(dialog).getByLabelText("Account password") as HTMLInputElement).value).toBe("");
    expect(challenge()).not.toBeInTheDocument();
  });

  it("offers change and removal when a PIN is set, and explains 409 PARENTAL_PIN_IN_USE", async () => {
    withPinConfigured(true);
    apiPost.mockRejectedValue(backendError(409, "PARENTAL_PIN_IN_USE"));
    renderManage();

    const section = await pinSection();
    expect(within(section).getByRole("button", { name: "Change PIN" })).toBeInTheDocument();
    await userEvent.click(within(section).getByRole("button", { name: "Remove PIN" }));
    const dialog = await screen.findByRole("dialog", { name: "Remove the parental PIN" });
    expect(within(dialog).queryByLabelText("New 6-digit PIN")).not.toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText("Account password"), "s3cret-pass");
    await userEvent.click(within(dialog).getByRole("button", { name: "Remove PIN" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Remove the age limit from every profile before removing the PIN.",
    );
    expect(apiPost).toHaveBeenCalledWith("/parental/pin/remove", {
      current_password: "s3cret-pass",
    });
  });
});
