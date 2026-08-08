import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useClearProgress, useSaveProgress } from "../api/hooks";
import { useToast } from "../components/ToastProvider";

interface ToggleArgs {
  /** Movie id, or the synthetic ``epi_<seriesId>_<season>_<episode>`` id. */
  mediaId: string;
  mediaType: "movie" | "episode";
  durationSeconds: number;
  /** Current state — passed in by the caller from its own data. */
  watched: boolean;
}

/**
 * Mark a movie/episode as watched or not, reusing the existing progress
 * endpoints: watched = save progress at the full duration (the backend
 * stamps ``completed``); unwatched = clear the progress record. Beyond
 * the mutations' own invalidations we also refresh the per-id progress
 * query and any series-detail query so the movie "Continuar", the
 * episode ``watch_status`` badges and Continue Watching all update.
 */
export function useWatchedToggle() {
  const queryClient = useQueryClient();
  const saveProgress = useSaveProgress();
  const clearProgress = useClearProgress();
  const { showToast } = useToast();
  const { t } = useTranslation();

  return useCallback(
    ({ mediaId, mediaType, durationSeconds, watched }: ToggleArgs) => {
      const refresh = () => {
        queryClient.invalidateQueries({ queryKey: ["progress", mediaId] });
        queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === "continueWatching" });
        // Episode watch_status lives in the series-detail payload.
        queryClient.invalidateQueries({ queryKey: ["series"] });
      };

      if (watched) {
        clearProgress.mutate(mediaId, {
          onSuccess: () => {
            refresh();
            showToast(t("progress.markedUnwatched"));
          },
        });
      } else {
        saveProgress.mutate(
          {
            media_id: mediaId,
            media_type: mediaType,
            position_seconds: durationSeconds,
            duration_seconds: durationSeconds,
          },
          {
            onSuccess: () => {
              refresh();
              showToast(t("progress.markedWatched"));
            },
          },
        );
      }
    },
    [queryClient, saveProgress, clearProgress, showToast, t],
  );
}
