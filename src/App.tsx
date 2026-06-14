import { useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "./components/admin";
import { Layout } from "./components/Layout";
import {
  AuthExpirationGuard,
  RedirectIfAuthenticated,
  RequireAdmin,
  RequireAuth,
} from "./components/auth";
import { SplashScreen } from "./components/SplashScreen";
import { Actor } from "./pages/Actor";
import { Browse } from "./pages/Browse";
import { Collection } from "./pages/Collection";
import { Home } from "./pages/Home";
import { Login } from "./pages/Login";
import { ManageProfiles } from "./pages/ManageProfiles";
import { MovieDetail } from "./pages/MovieDetail";
import { Player } from "./pages/Player";
import { Profiles } from "./pages/Profiles";
import { SeriesDetail } from "./pages/SeriesDetail";
import { MyLists } from "./pages/MyLists";
import { Settings } from "./pages/Settings";
import { CatalogRequestsAdmin } from "./pages/admin/CatalogRequestsAdmin";
import { EnrichAdmin } from "./pages/admin/EnrichAdmin";
import { HealthAdmin } from "./pages/admin/HealthAdmin";
import { HlsCacheAdmin } from "./pages/admin/HlsCacheAdmin";
import { ConflictsAdmin } from "./pages/admin/ConflictsAdmin";
import { IntroPicker } from "./pages/admin/IntroPicker";
import { IntroEditor } from "./pages/admin/IntroEditor";
import { LibrariesAdmin } from "./pages/admin/LibrariesAdmin";
import { LibraryDetailAdmin } from "./pages/admin/LibraryDetailAdmin";
import { MovieReview } from "./pages/admin/MovieReview";
import { MoviesAdmin } from "./pages/admin/MoviesAdmin";
import { AdminOverview } from "./pages/admin/Overview";
import { ScanAdmin } from "./pages/admin/ScanAdmin";
import { SeriesAdmin } from "./pages/admin/SeriesAdmin";
import { SeriesReview } from "./pages/admin/SeriesReview";
import { SettingsAdmin } from "./pages/admin/SettingsAdmin";
import { UserDetailAdmin } from "./pages/admin/UserDetailAdmin";
import { UsersAdmin } from "./pages/admin/UsersAdmin";
import { theme } from "./theme";
import "@fontsource/inter/200.css";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "./i18n";

const queryClient = new QueryClient();

const SPLASH_SESSION_KEY = "homeflix:splash-shown";

function App() {
  // Show the boot splash once per browser session — first visit /
  // hard reload triggers it, route changes don't. ``sessionStorage``
  // is read inside the initializer so the first paint already knows
  // which mode to render in (no flash of "splash then app then
  // splash gone again").
  const [splashOpen, setSplashOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(SPLASH_SESSION_KEY) !== "1";
  });

  const handleSplashDone = () => {
    setSplashOpen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(SPLASH_SESSION_KEY, "1");
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {splashOpen && <SplashScreen onDone={handleSplashDone} />}
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          {/* Listens for the global auth-expired event from
              ``api/client.ts`` and redirects to /login. Sits
              above ``<Routes>`` so it's always alive regardless
              of which page the expiration lands on. */}
          <AuthExpirationGuard />
          <Routes>
            {/* Login bounces to /profiles when the visitor is
                already authenticated — keeps the back button
                from looping users through a form they don't
                need. */}
            <Route element={<RedirectIfAuthenticated />}>
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Everything else requires a logged-in user. The
                guard sits above ``<Layout />`` so anonymous
                visitors never see app chrome flash before the
                redirect. The two ``/play/*`` routes are wrapped
                separately because they bypass the Layout
                wrapper for fullscreen playback. */}
            <Route element={<RequireAuth />}>
              <Route path="/profiles" element={<Profiles />} />
              <Route path="/profiles/manage" element={<ManageProfiles />} />
              <Route path="/play/movie/:movieId" element={<Player />} />
              <Route path="/play/episode/:seriesId/:season/:episode" element={<Player />} />
              <Route element={<Layout />}>
                <Route path="/" element={<Home />} />
                <Route path="/browse" element={<Browse />} />
                <Route path="/movie/:movieId" element={<MovieDetail />} />
                <Route path="/series/:seriesId" element={<SeriesDetail />} />
                <Route path="/collection/:tmdbId" element={<Collection />} />
                <Route path="/actor/:name" element={<Actor />} />
                <Route path="/lists" element={<MyLists />} />
                <Route path="/settings" element={<Settings />} />
              </Route>
              {/* /admin/* requires admin role on top of auth and lives
                  in its own ``AdminLayout`` shell (sidebar + topbar +
                  main grid). RequireAdmin redirects non-admin members
                  back to "/" so the catalog stays usable; the backend
                  enforces the gate independently via 403 on the
                  underlying API calls. */}
              <Route element={<RequireAdmin />}>
                <Route element={<AdminLayout />}>
                  <Route path="/admin" element={<AdminOverview />} />
                  <Route path="/admin/libraries" element={<LibrariesAdmin />} />
                  <Route path="/admin/libraries/new" element={<LibraryDetailAdmin />} />
                  <Route path="/admin/libraries/:id" element={<LibraryDetailAdmin />} />
                  <Route path="/admin/catalog/movies" element={<MoviesAdmin />} />
                  <Route path="/admin/catalog/series" element={<SeriesAdmin />} />
                  <Route path="/admin/requests" element={<CatalogRequestsAdmin />} />
                  <Route path="/admin/intros" element={<IntroPicker />} />
                  <Route
                    path="/admin/intros/:seriesId/:season/:episode"
                    element={<IntroEditor />}
                  />
                  <Route path="/admin/catalog/review" element={<MovieReview />} />
                  <Route path="/admin/catalog/series-review" element={<SeriesReview />} />
                  <Route path="/admin/catalog/conflicts" element={<ConflictsAdmin />} />
                  {/* Legacy redirect — bookmarks / open tabs landing
                      on the old movie-review path get folded into the
                      new catalog/review namespace. */}
                  <Route
                    path="/admin/movies/review"
                    element={<Navigate to="/admin/catalog/review" replace />}
                  />
                  <Route path="/admin/users" element={<UsersAdmin />} />
                  <Route path="/admin/users/:id" element={<UserDetailAdmin />} />
                  <Route path="/admin/scan" element={<ScanAdmin />} />
                  <Route path="/admin/enrich" element={<EnrichAdmin />} />
                  <Route path="/admin/system/hls-cache" element={<HlsCacheAdmin />} />
                  <Route path="/admin/system/health" element={<HealthAdmin />} />
                  <Route path="/admin/system/settings" element={<SettingsAdmin />} />
                </Route>
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
