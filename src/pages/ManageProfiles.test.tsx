import { ThemeProvider } from "@mui/material";
import { type QueryKey, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../api/queryClient";
import type { Library, Profile, User } from "../api/types";
import { RequireAuth } from "../components/auth";
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
        <MemoryRouter initialEntries={["/profiles/manage"]}>
          <Routes>
            <Route element={<RequireAuth />}>
              <Route path="/profiles/manage" element={<ManageProfiles />} />
            </Route>
          </Routes>
        </MemoryRouter>
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
    await userEvent.click(screen.getByRole("radio", { name: "L" }));
    const [, body] = await save();

    expect(wire(body)).toHaveProperty("maturity_limit", 0);
  });

  it("creates a profile with the chosen limit", async () => {
    renderManage();

    await createNamed("Teen");
    await userEvent.click(screen.getByRole("radio", { name: "16" }));
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
});
