import { Box, MenuItem, Select, Stack, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { whiteAlpha } from "../../theme/tokens";
import { AdminButton } from "./AdminButton";

interface AdminTablePaginationProps {
  pageNumber: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  /** ``true`` while a fetch is in flight; disables both buttons. */
  isFetching?: boolean;
  /** Current page-size value. When omitted the size selector is hidden. */
  pageSize?: number;
  /** Page-size options; defaults to ``[15, 30, 50, 100]``. */
  pageSizeOptions?: readonly number[];
  /** Called when the operator picks a different size from the select. */
  onPageSizeChange?: (size: number) => void;
}

const DEFAULT_SIZE_OPTIONS = [10, 25, 50, 100] as const;

/**
 * Pagination footer for admin tables — page-size select on the
 * left + page indicator + Previous / Next buttons on the right.
 * Drops in below an ``AdminTable`` wired to
 * ``usePagedInfiniteQuery``.
 *
 * The component is stateless: it renders controls and forwards
 * clicks. State (current page index, has-more, etc.) lives in
 * the consumer hook.
 */
export function AdminTablePagination({
  pageNumber,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  isFetching = false,
  pageSize,
  pageSizeOptions = DEFAULT_SIZE_OPTIONS,
  onPageSizeChange,
}: AdminTablePaginationProps) {
  const { t } = useTranslation();
  const showSizeSelect = pageSize !== undefined && onPageSizeChange !== undefined;
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        py: 2,
        px: 1,
        gap: 2,
        flexWrap: "wrap",
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.5}>
        {showSizeSelect && (
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: "0.78125rem" }}
            >
              {t("admin.table.pagination.rowsPerPage")}
            </Typography>
            <Select<number>
              size="small"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              disabled={isFetching}
              sx={{
                fontSize: "0.8125rem",
                bgcolor: whiteAlpha(0.025),
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                "& .MuiSelect-select": { py: 0.5, pr: "28px !important", pl: 1.25 },
              }}
            >
              {pageSizeOptions.map((opt) => (
                <MenuItem key={opt} value={opt} sx={{ fontSize: "0.8125rem" }}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </Stack>
        )}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontFamily: "'JetBrains Mono', ui-monospace, monospace",
            fontSize: "0.78125rem",
          }}
        >
          {t("admin.table.pagination.page", { number: pageNumber })}
        </Typography>
      </Stack>
      <Stack direction="row" spacing={1.25}>
        <AdminButton
          variant="ghost"
          icon={<ChevronLeft size={15} />}
          disabled={!canGoPrevious || isFetching}
          onClick={onPrevious}
        >
          {t("admin.table.pagination.previous")}
        </AdminButton>
        <AdminButton
          variant="secondary"
          disabled={!canGoNext || isFetching}
          onClick={onNext}
          endIcon={<ChevronRight size={15} />}
        >
          {t("admin.table.pagination.next")}
        </AdminButton>
      </Stack>
    </Box>
  );
}
