import { ThemeProvider } from "@mui/material";
import { type QueryKey, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryClient } from "../api/queryClient";
import type { Library, Profile, User } from "../api/types";
import { RequireAuth } from "../components/auth";
import i18n from "../i18n";
import { theme } from "../theme";
import { ManageProfiles } from "./ManageProfiles";

const { apiGet, apiPut, apiDel } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  apiDel: vi.fn(),
}));

vi.mock("../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../api/client")>()),
  api: { get: apiGet, post: vi.fn(), put: apiPut, patch: vi.fn(), del: apiDel },
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
    if (path === "/profiles") return Promise.resolve({ data: [ALICE, BOB] });
    if (path === "/libraries") return Promise.resolve({ data: LIBRARIES });
    return new Promise(() => {});
  });
  apiPut.mockImplementation((path: string, body: Partial<Profile>) => {
    const target = path.endsWith(ALICE.id) ? ALICE : BOB;
    return Promise.resolve({ data: { ...target, ...body } });
  });
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
    // The dialog does not edit the limit yet, so the server's answer is
    // what moves it: same name and libraries, a limit where there was none.
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
