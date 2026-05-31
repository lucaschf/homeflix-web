import {
  Alert,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { Check, Search, Send, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import {
  useCatalogLookup,
  useRequestCatalogInclusion,
} from "../api/hooks";
import type { CatalogLookupCandidate } from "../api/types";
import { success } from "../theme/colors";

interface RequestTitleDialogProps {
  open: boolean;
  onClose: () => void;
  /** Optional pre-fill (e.g. from the search overlay's no-results CTA). */
  initialQuery?: string;
}

/**
 * "Request a title" dialog — Overseerr-style request hub.
 *
 * Accepts a TMDB id, IMDb id, TMDB URL, IMDb URL or plain title and
 * asks the backend's ``/catalog/lookup`` proxy for picker candidates.
 * Clicking a candidate POSTs to ``/catalog-requests`` so the admin
 * queue sees the request and the enrich loop fulfils it once the
 * title lands locally. Idempotent — re-requesting an already-pending
 * row just returns the existing entry.
 */
export function RequestTitleDialog({
  open,
  onClose,
  initialQuery,
}: RequestTitleDialogProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState(initialQuery ?? "");
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set());
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const lookup = useCatalogLookup(query);
  const request = useRequestCatalogInclusion();

  // Pre-fill + reset when the dialog opens/closes. The dependency on
  // ``open`` matters: a parent that re-renders with the same
  // ``initialQuery`` shouldn't clobber what the user has been typing,
  // only the open transition should seed. Bounded one-shot cascade
  // (same pattern as SearchOverlay) — three sets, no loop.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(initialQuery ?? "");
      setRequestedIds(new Set());
      setErrorMessage(null);
    }
  }, [open, initialQuery]);

  const handleClose = () => {
    if (request.isPending) return;
    onClose();
  };

  const handleRequest = async (candidate: CatalogLookupCandidate) => {
    setErrorMessage(null);
    try {
      const result = await request.mutateAsync({
        tmdb_id: candidate.tmdb_id,
        media_type: candidate.media_type === "tv" ? "series" : "movie",
        title: candidate.title,
      });
      setRequestedIds((prev) => new Set(prev).add(candidateKey(candidate)));
      // No close — keep the dialog open so the user can request more
      // than one if they paste a URL set or want sequels too.
      // The Chip flips to "Requested" via ``requestedIds``.
      if (result.is_fulfilled) {
        setErrorMessage(t("request.snack.alreadyAvailable"));
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("request.snack.failed");
      setErrorMessage(msg);
    }
  };

  const trimmed = query.trim();
  const showResults = trimmed.length > 0;
  const candidates = lookup.data?.candidates ?? [];

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h6">{t("request.dialog.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("request.dialog.subtitle")}
          </Typography>
        </Box>
        <IconButton size="small" onClick={handleClose} disabled={request.isPending}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ pb: 3 }}>
        <TextField
          autoFocus
          fullWidth
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("request.dialog.placeholder")}
          slotProps={{
            input: {
              startAdornment: (
                <Search
                  size={16}
                  style={{ marginRight: 8, opacity: 0.6, flexShrink: 0 }}
                />
              ),
            },
          }}
          sx={{ mb: 2 }}
        />

        {errorMessage && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {errorMessage}
          </Alert>
        )}

        {!showResults && (
          <Stack spacing={1} sx={{ py: 4, alignItems: "center" }}>
            <Typography variant="body2" color="text.secondary" align="center">
              {t("request.dialog.hint")}
            </Typography>
            <Typography
              variant="caption"
              color="text.tertiary"
              align="center"
              sx={{ maxWidth: 420 }}
            >
              {t("request.dialog.hintExamples")}
            </Typography>
          </Stack>
        )}

        {showResults && lookup.isLoading && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={24} />
          </Box>
        )}

        {showResults && !lookup.isLoading && lookup.isError && (
          <Alert severity="error" sx={{ my: 2 }}>
            {t("request.dialog.lookupFailed")}
          </Alert>
        )}

        {showResults &&
          !lookup.isLoading &&
          !lookup.isError &&
          candidates.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4 }}>
              {t("request.dialog.noCandidates", { query: trimmed })}
            </Typography>
          )}

        {candidates.length > 0 && (
          <Stack spacing={1.5}>
            {candidates.map((candidate) => (
              <CandidateRow
                key={candidateKey(candidate)}
                candidate={candidate}
                isRequested={requestedIds.has(candidateKey(candidate))}
                isPending={request.isPending}
                onRequest={() => void handleRequest(candidate)}
              />
            ))}
          </Stack>
        )}
      </DialogContent>
    </Dialog>
  );
}

function candidateKey(c: CatalogLookupCandidate): string {
  return `${c.media_type}:${c.tmdb_id}`;
}

function CandidateRow({
  candidate,
  isRequested,
  isPending,
  onRequest,
}: {
  candidate: CatalogLookupCandidate;
  isRequested: boolean;
  isPending: boolean;
  onRequest: () => void;
}) {
  const { t } = useTranslation();
  const handleClick = () => {
    if (isRequested || isPending) return;
    onRequest();
  };
  return (
    <Box
      onClick={handleClick}
      sx={{
        display: "flex",
        gap: 1.5,
        p: 1.25,
        borderRadius: 1.5,
        cursor: isRequested || isPending ? "default" : "pointer",
        bgcolor: isRequested ? "rgba(80,180,120,0.08)" : "transparent",
        border: "1px solid rgba(255,255,255,0.06)",
        transition: "background-color 120ms",
        "&:hover": isRequested || isPending
          ? {}
          : { bgcolor: "rgba(255,255,255,0.04)" },
      }}
    >
      <Box
        sx={{
          width: 56,
          minWidth: 56,
          height: 84,
          borderRadius: 1,
          bgcolor: "rgba(255,255,255,0.06)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {candidate.poster_url && (
          <Box
            component="img"
            src={candidate.poster_url}
            alt=""
            sx={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        )}
      </Box>
      <Box sx={{ flexGrow: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Typography
            variant="body1"
            sx={{
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {candidate.title}
          </Typography>
          {candidate.year != null && (
            <Typography variant="body2" color="text.secondary">
              ({candidate.year})
            </Typography>
          )}
          <Chip
            label={t(
              candidate.media_type === "tv"
                ? "request.badge.series"
                : "request.badge.movie",
            )}
            size="small"
            sx={{ height: 18, fontSize: "0.65rem" }}
          />
        </Stack>
        {candidate.overview && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: 2,
              overflow: "hidden",
            }}
          >
            {candidate.overview}
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center" }}>
        {isRequested ? (
          <Chip
            icon={<Check size={14} />}
            label={t("request.badge.requested")}
            size="small"
            sx={{
              bgcolor: `${success.main}33`,
              color: success.main,
              ".MuiChip-icon": { color: success.main },
            }}
          />
        ) : (
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            disabled={isPending}
            aria-label={t("request.action.request")}
          >
            <Send size={16} />
          </IconButton>
        )}
      </Box>
    </Box>
  );
}
