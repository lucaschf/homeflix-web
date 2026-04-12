import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  InputBase,
  Typography,
} from "@mui/material";
import { Film, Search, Tv, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useSearch } from "../api/hooks";
import type { CatalogItem } from "../api/types";
import { neutral } from "../theme/colors";

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
  const { data: searchResults, isLoading: searchLoading } = useSearch(query);
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

  const handleSelect = (item: CatalogItem) => {
    saveRecentSearch(item.title);
    onClose();
    navigate(item.type === "movie" ? `/movie/${item.id}` : `/series/${item.id}`);
  };

  const handleRecentClick = (term: string) => {
    setQuery(term);
  };

  // Results come from the server, already ranked by relevance.
  const normalizedQuery = query.trim();
  const hasResults = searchResults.length > 0;
  const showNoResults = normalizedQuery.length >= 1 && !searchLoading && !hasResults;

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
        <Search size={20} color={neutral[400]} />
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

        {/* Loading spinner */}
        {searchLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} color="primary" />
          </Box>
        )}

        {/* Results — unified list ranked by relevance */}
        {hasResults && (
          <Box sx={{ px: 1.5, py: 1 }}>
            {searchResults.map((item) => (
              <SearchResultRow
                key={item.id}
                item={item}
                onSelect={handleSelect}
              />
            ))}
          </Box>
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

function SearchResultRow({
  item,
  onSelect,
}: {
  item: CatalogItem;
  onSelect: (item: CatalogItem) => void;
}) {
  const { t } = useTranslation();
  return (
    <Box
      onClick={() => onSelect(item)}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        py: 0.75,
        px: 1,
        borderRadius: 1.5,
        cursor: "pointer",
        "&:hover": { bgcolor: "action.hover" },
      }}
    >
      {/* Poster thumbnail or placeholder */}
      <Box
        sx={{
          width: 40,
          height: 56,
          borderRadius: 1,
          overflow: "hidden",
          flexShrink: 0,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {item.poster_path ? (
          <Box
            component="img"
            src={item.poster_path}
            alt=""
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Box sx={{ color: "text.disabled" }}>
            {item.type === "movie" ? <Film size={16} /> : <Tv size={16} />}
          </Box>
        )}
      </Box>

      {/* Title + metadata */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={500} noWrap>
          {item.title}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
          <Chip
            label={item.type === "movie" ? t("search.movies") : t("search.series")}
            size="small"
            sx={{
              height: 18,
              fontSize: "0.6rem",
              fontWeight: 600,
              bgcolor: "action.selected",
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {item.year}
          </Typography>
          {item.genres.length > 0 && (
            <Typography variant="caption" color="text.disabled" noWrap>
              · {item.genres.slice(0, 2).join(", ")}
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
}
