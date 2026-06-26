import { useMemo, useState } from "react";
import { Box, CircularProgress, Dialog, InputAdornment, TextField, Typography } from "@mui/material";
import { Check, Plus, Search, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAddItemToCustomList, useSearch } from "../../api/hooks";
import { AdminButton } from "../admin/AdminButton";
import { neutral } from "../../theme/colors";
import { fontFamily, inkAlpha, peachAlpha, scrim, whiteAlpha } from "../../theme/tokens";

type Filter = "all" | "movie" | "series";

interface AddTitlesDialogProps {
  open: boolean;
  onClose: () => void;
  listId: string;
  /** media ids already in the list — shown checked + disabled. */
  existingIds: Set<string>;
}

/**
 * Catalog-search dialog to bulk-add movies + series to a custom list.
 * Multi-select with a type filter; already-present items are dimmed and
 * locked. Confirming appends every selection to the list.
 */
export function AddTitlesDialog({ open, onClose, listId, existingIds }: AddTitlesDialogProps) {
  const { t } = useTranslation();
  const addItem = useAddItemToCustomList();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<Map<string, "movie" | "series">>(new Map());

  // Reset search/filter/selection each time the dialog opens. Adjusting
  // state during render (vs an effect) is the idiomatic React pattern.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQuery("");
      setFilter("all");
      setSelected(new Map());
    }
  }

  const { data: results, isLoading } = useSearch(query);
  const filtered = useMemo(
    () => results.filter((r) => filter === "all" || r.type === filter),
    [results, filter],
  );

  const toggle = (id: string, type: "movie" | "series") => {
    if (existingIds.has(id)) return;
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, type);
      return next;
    });
  };

  const handleAdd = async () => {
    await Promise.all(
      [...selected].map(([id, type]) =>
        addItem.mutateAsync({ listId, media_id: id, media_type: type }),
      ),
    );
    onClose();
  };

  const filters: [Filter, string][] = [
    ["all", t("lists.filterAll")],
    ["movie", t("lists.filterMovies")],
    ["series", t("lists.filterSeries")],
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      slotProps={{
        paper: {
          sx: {
            width: 760,
            maxWidth: "92vw",
            maxHeight: "82vh",
            display: "flex",
            flexDirection: "column",
            bgcolor: "background.paper",
            borderRadius: "14px",
            border: `1px solid ${whiteAlpha(0.1)}`,
          },
        },
      }}
    >
      {/* header */}
      <Box sx={{ px: 3, pt: 2.75 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 2 }}>
          <Box>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 600 }}>{t("lists.addTitles")}</Typography>
            <Typography sx={{ mt: 0.4, fontSize: "0.74rem", color: "text.secondary" }}>
              {t("lists.addTitlesSubtitle")}
            </Typography>
          </Box>
          <AdminButton
            variant="secondary"
            aria-label={t("lists.cancel")}
            onClick={onClose}
            sx={{ minWidth: 0, px: 1 }}
          >
            <X size={14} />
          </AdminButton>
        </Box>

        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder={t("lists.searchMedia")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          sx={{ mt: 2.25 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color={neutral[600]} />
                </InputAdornment>
              ),
              endAdornment: query ? (
                <InputAdornment position="end">
                  <Box
                    component="button"
                    type="button"
                    onClick={() => setQuery("")}
                    sx={{ all: "unset", cursor: "pointer", display: "flex", color: "text.secondary" }}
                  >
                    <X size={14} />
                  </Box>
                </InputAdornment>
              ) : null,
            },
          }}
        />

        <Box sx={{ display: "flex", gap: 1, mt: 1.75 }}>
          {filters.map(([key, label]) => {
            const active = filter === key;
            return (
              <Box
                key={key}
                component="button"
                type="button"
                onClick={() => setFilter(key)}
                sx={{
                  px: 1.6,
                  py: 0.75,
                  borderRadius: 20,
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontWeight: 500,
                  border: `1px solid ${active ? "transparent" : whiteAlpha(0.08)}`,
                  bgcolor: active ? peachAlpha(0.16) : "transparent",
                  color: active ? "primary.main" : "text.secondary",
                  transition: "color 120ms, background-color 120ms",
                  "&:hover": { color: active ? "primary.main" : "text.primary" },
                }}
              >
                {label}
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* results */}
      <Box sx={{ flex: 1, overflowY: "auto", overflowX: "hidden", px: 3, py: 2.25, mt: 1 }}>
        {!query.trim() ? (
          <Centered>{t("lists.addTitlesPrompt")}</Centered>
        ) : isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress color="primary" size={28} />
          </Box>
        ) : filtered.length === 0 ? (
          <Centered>{t("lists.noSearchResults", { query: query.trim() })}</Centered>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))",
              columnGap: 2,
              rowGap: 2.5,
            }}
          >
            {filtered.map((item) => (
              <ResultCard
                key={item.id}
                item={item}
                already={existingIds.has(item.id)}
                picked={selected.has(item.id)}
                onToggle={() => toggle(item.id, item.type)}
              />
            ))}
          </Box>
        )}
      </Box>

      {/* footer */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
          px: 3,
          py: 2,
          borderTop: `1px solid ${whiteAlpha(0.08)}`,
          bgcolor: scrim(0.2),
        }}
      >
        <Typography sx={{ fontSize: "0.82rem", color: selected.size ? "text.primary" : "text.secondary" }}>
          {selected.size
            ? t("lists.selectedCount", { count: selected.size })
            : t("lists.noneSelected")}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.25 }}>
          <AdminButton variant="ghost" onClick={onClose}>
            {t("lists.cancel")}
          </AdminButton>
          <AdminButton
            variant="primary"
            icon={<Plus size={15} />}
            disabled={!selected.size || addItem.isPending}
            onClick={handleAdd}
          >
            {selected.size ? t("lists.addSelectedCount", { count: selected.size }) : t("lists.addSelected")}
          </AdminButton>
        </Box>
      </Box>
    </Dialog>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ py: 6, textAlign: "center", color: "text.secondary", fontSize: "0.86rem" }}>
      {children}
    </Box>
  );
}

/** A single selectable search result. */
function ResultCard({
  item,
  already,
  picked,
  onToggle,
}: {
  item: { id: string; type: "movie" | "series"; title: string; year: number; poster_path: string | null };
  already: boolean;
  picked: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation();
  const checked = picked || already;
  return (
    <Box onClick={onToggle} sx={{ cursor: already ? "default" : "pointer", opacity: already ? 0.5 : 1 }}>
      <Box
        sx={{
          position: "relative",
          aspectRatio: "2 / 3",
          borderRadius: 2,
          overflow: "hidden",
          border: picked ? "2px solid" : `1px solid ${whiteAlpha(0.08)}`,
          borderColor: picked ? "primary.main" : undefined,
          backgroundColor: "background.default",
          ...(item.poster_path
            ? { backgroundImage: `url(${item.poster_path})`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}),
        }}
      >
        {!item.poster_path && (
          <Box
            sx={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              p: 1.25,
              textAlign: "center",
              fontFamily: "serif",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: inkAlpha(0.85),
            }}
          >
            {item.title.toUpperCase()}
          </Box>
        )}

        {/* type badge */}
        <Box
          sx={{
            position: "absolute",
            top: 7,
            left: 7,
            px: 0.75,
            py: "2px",
            borderRadius: "4px",
            bgcolor: scrim(0.62),
            backdropFilter: "blur(4px)",
            border: `1px solid ${whiteAlpha(0.12)}`,
            fontFamily: fontFamily.mono,
            fontSize: "0.53rem",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: inkAlpha(0.9),
          }}
        >
          {item.type === "series" ? t("lists.typeSeries") : t("lists.typeMovie")}
        </Box>

        {/* selection circle */}
        <Box
          sx={{
            position: "absolute",
            top: 7,
            right: 7,
            width: 24,
            height: 24,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            bgcolor: checked ? "primary.main" : scrim(0.6),
            border: checked ? "none" : `1.5px solid ${whiteAlpha(0.35)}`,
            backdropFilter: "blur(4px)",
          }}
        >
          {checked && <Check size={13} color="#0A0A0A" strokeWidth={3} />}
        </Box>
      </Box>

      <Typography
        sx={{
          mt: 1,
          fontSize: "0.78rem",
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {item.title}
      </Typography>
      <Typography sx={{ mt: 0.25, fontSize: "0.66rem", color: "text.secondary", fontFamily: fontFamily.mono }}>
        {already ? t("lists.inList") : item.year}
      </Typography>
    </Box>
  );
}
