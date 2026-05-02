import { useState } from "react";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SplashScreen } from "./components/SplashScreen";
import { Actor } from "./pages/Actor";
import { Browse } from "./pages/Browse";
import { Collection } from "./pages/Collection";
import { Home } from "./pages/Home";
import { MovieDetail } from "./pages/MovieDetail";
import { Player } from "./pages/Player";
import { SeriesDetail } from "./pages/SeriesDetail";
import { MyLists } from "./pages/MyLists";
import { Settings } from "./pages/Settings";
import { IntroPicker } from "./pages/admin/IntroPicker";
import { IntroEditor } from "./pages/admin/IntroEditor";
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
          <Routes>
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
              <Route path="/admin/intros" element={<IntroPicker />} />
              <Route
                path="/admin/intros/:seriesId/:season/:episode"
                element={<IntroEditor />}
              />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
