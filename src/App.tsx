import { ThemeProvider, CssBaseline } from "@mui/material";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { Browse } from "./pages/Browse";
import { Home } from "./pages/Home";
import { MovieDetail } from "./pages/MovieDetail";
import { Player } from "./pages/Player";
import { SeriesDetail } from "./pages/SeriesDetail";
import { Settings } from "./pages/Settings";
import { theme } from "./theme";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "./i18n";

const queryClient = new QueryClient();

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
