import { ThemeProvider } from "@mui/material";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation, useParams } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMovie } from "../../api/hooks";
import { createQueryClient } from "../../api/queryClient";
import type { Profile, User } from "../../api/types";
import i18n from "../../i18n";
import { Profiles } from "../../pages/Profiles";
import { theme } from "../../theme";
import { ParentalPinProvider } from "../parental/ParentalPinProvider";
import { ToastProvider } from "../ToastProvider";
import { AuthExpirationGuard } from "./AuthExpirationGuard";
import { RedirectIfAuthenticated } from "./RedirectIfAuthenticated";
import { RequireAuth } from "./RequireAuth";

// No ``api`` mock: the 401 has to travel through the real client, which is
// what dispatches the session-expired event. Only ``fetch`` is stubbed.

const USER: User = {
  id: "usr_1",
  email: "parent@home.test",
  role: "admin",
  is_active: true,
  is_verified: true,
  // Detached by a widening elsewhere (ADR-035 D12): no profile any more.
  active_profile_id: null,
};

const profile = (id: string, name: string): Profile => ({
  id,
  user_id: USER.id,
  name,
  avatar_url: null,
  is_kids: false,
  allowed_library_ids: [],
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
});

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** The backend of a device whose session lost its profile. */
function detachedSession(input: RequestInfo | URL): Promise<Response> {
  const url = new URL(String(input), "http://homeflix.test");
  switch (url.pathname) {
    case "/api/v1/users/me":
      return Promise.resolve(json(200, { data: USER }));
    case "/api/v1/profiles":
      return Promise.resolve(
        json(200, { data: [profile("prf_parent", "Parent"), profile("prf_kid", "Kid")] }),
      );
    default:
      return Promise.resolve(
        json(401, { code: "UNAUTHORIZED", message: "No active profile", details: [] }),
      );
  }
}

function MovieProbe() {
  const { movieId } = useParams();
  const { isError } = useMovie(movieId!);
  return <p>{isError ? "movie failed" : "movie loading"}</p>;
}

let visited: string[] = [];

function LocationProbe() {
  const location = useLocation();
  visited.push(location.pathname);
  return <output aria-label="location">{location.pathname}</output>;
}

function renderApp(path: string) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ThemeProvider theme={theme}>
        <ToastProvider>
          <ParentalPinProvider>
            <MemoryRouter initialEntries={[path]}>
              <AuthExpirationGuard />
              <LocationProbe />
              <Routes>
                <Route element={<RedirectIfAuthenticated />}>
                  <Route path="/login" element={<p>Sign-in form</p>} />
                </Route>
                <Route element={<RequireAuth />}>
                  <Route path="/profiles" element={<Profiles />} />
                  <Route path="/movie/:movieId" element={<MovieProbe />} />
                </Route>
              </Routes>
            </MemoryRouter>
          </ParentalPinProvider>
        </ToastProvider>
      </ThemeProvider>
    </QueryClientProvider>,
  );
}

beforeEach(async () => {
  visited = [];
  await i18n.changeLanguage("en");
  vi.stubGlobal("fetch", vi.fn(detachedSession));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("AuthExpirationGuard — detached session (ADR-035 D12)", () => {
  it("ends on the profile picker, not the sign-in form, after a catalog 401 while /users/me is 200", async () => {
    renderApp("/movie/mov_1");

    expect(await screen.findByText("Who's watching?")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByLabelText("location")).toHaveTextContent("/profiles"));
    expect(screen.queryByText("Sign-in form")).not.toBeInTheDocument();
    // The catalog request did fail with 401 and went through /login on the way.
    const fetched = vi.mocked(fetch).mock.calls.map(([input]) => String(input));
    expect(fetched.some((url) => url.startsWith("/api/v1/movies/mov_1"))).toBe(true);
    expect(visited).toContain("/login");
  });
});
