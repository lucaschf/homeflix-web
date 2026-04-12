import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Dialog,
  IconButton,
  InputBase,
  Typography,
} from "@mui/material";
import { Film, Search, Tv, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMovies, useSeries } from "../api/hooks";

const RECENT_STORAGE_KEY = "homeflix-recent-searches";
const MAX_RECENT = 5;

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const { data: moviesData } = useMovies();
  const { data: seriesData } = useSeries();

  const allItems = useMemo(() => {
    const movies = (moviesData?.movies ?? []).map((m) => ({
      id: m.id, title: m.title, year: m.year, type: "movie" as const,
    }));
    const series = (seriesData?.series ?? []).map((s) => ({
      id: s.id, title: s.title, year: s.start_year, type: "series" as const,
    }));
    return [...movies, ...series];
  }, [moviesData, seriesData]);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(RECENT_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  });

  // Focus input and clear query on open. The `setQuery("")` is a
  // bounded one-shot cascade (one extra render per open, no loop)
  // and is the simplest way to clear stale search text without
  // forcing a remount via `key`. The lint suppression is intentional.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
    }
  }, [open]);

  // Ctrl+K shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        if (!open) {
          // Parent will handle opening
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  const saveRecentSearch = useCallback((term: string) => {
    setRecentSearches((prev) => {
      const updated = [term, ...prev.filter((s) => s !== term)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_STORAGE_KEY);
  }, []);

  const handleSelect = (item: (typeof allItems)[0]) => {
    saveRecentSearch(item.title);
    onClose();
    navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
  };

  // Filter results
  const normalizedQuery = query.toLowerCase().trim();
  const results = normalizedQuery.length >= 1
    ? allItems.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : [];

  const movies = results.filter((r) => r.type === "movie");
  const series = results.filter((r) => r.type === "series");
  const hasResults = results.length > 0;
  const showNoResults = normalizedQuery.length >= 1 && !hasResults;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="sm"
      sx={{
        "& .MuiDialog-container": { alignItems: "flex-start", pt: 10 },
        "& .MuiPaper-root": {
          bgcolor: "background.paper",
          backgroundImage: "none",
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          maxHeight: "70vh",
        },
      }}
    >
      {/* Search Input */}
      <Box sx={{ display: "flex", alignItems: "center", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <Search size={20} color="var(--mui-palette-text-secondary)" />
        <InputBase
          inputRef={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          sx={{ flex: 1, ml: 1.5, fontSize: "0.95rem", color: "text.primary" }}
        />
        <IconButton onClick={onClose} size="small" sx={{ color: "text.secondary" }}>
          <X size={18} />
        </IconButton>
      </Box>

      {/* Content */}
      <Box sx={{ overflowY: "auto", maxHeight: "calc(70vh - 60px)" }}>
        {/* Recent Searches (when no query) */}
        {!normalizedQuery && recentSearches.length > 0 && (
          <Box sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
              <Typography variant="body2" color="text.secondary" fontWeight={600}>
                {t("search.recentSearches")}
              </Typography>
              <Typography
                variant="caption"
                onClick={clearRecent}
                sx={{ color: "primary.main", cursor: "pointer", "&:hover": { textDecoration: "underline" } }}
              >
                {t("search.clearAll")}
              </Typography>
            </Box>
            {recentSearches.map((term) => (
              <Box
                key={term}
                onClick={() => handleRecentClick(term)}
                sx={{
                  py: 1,
                  px: 1,
                  borderRadius: 1,
                  cursor: "pointer",
                  "&:hover": { bgcolor: "action.hover" },
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {term}
                </Typography>
              </Box>
            ))}
          </Box>
        )}

        {/* Results */}
        {movies.length > 0 && (
          <ResultSection
            title={t("search.movies")}
            items={movies}
            icon={<Film size={16} />}
            onSelect={handleSelect}
          />
        )}
        {series.length > 0 && (
          <ResultSection
            title={t("search.series")}
            items={series}
            icon={<Tv size={16} />}
            onSelect={handleSelect}
          />
        )}

        {/* No Results */}
        {showNoResults && (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <Typography variant="body1" color="text.secondary">
              {t("search.noResults", { query })}
            </Typography>
            <Typography variant="body2" color="text.tertiary" sx={{ mt: 0.5 }}>
              {t("search.tryDifferent")}
            </Typography>
          </Box>
        )}
      </Box>
    </Dialog>
  );
}

interface ResultSectionProps {
  title: string;
  items: { id: string; title: string; year: number; type: "movie" | "series" }[];
  icon: React.ReactNode;
  onSelect: (item: { id: string; title: string; year: number; type: "movie" | "series" }) => void;
}

function ResultSection({ title, items, icon, onSelect }: ResultSectionProps) {
  return (
    <Box sx={{ px: 2.5, py: 1.5 }}>
      <Typography variant="body2" color="text.secondary" fontWeight={600} sx={{ mb: 1 }}>
        {title} ({items.length})
      </Typography>
      {items.map((item) => (
        <Box
          key={item.id}
          onClick={() => onSelect(item)}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            py: 1,
            px: 1,
            borderRadius: 1,
            cursor: "pointer",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <Box sx={{ color: "text.secondary", flexShrink: 0 }}>{icon}</Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" fontWeight={500} noWrap>
              {item.title}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">
            {item.year}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}
