import {
  Box,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AdminButton } from "./AdminButton";
import { AdminEmptyState } from "./AdminEmptyState";

export type TableDensity = "comfortable" | "compact";

export interface AdminTableColumn<T> {
  id: string;
  label: ReactNode;
  /** CSS width (e.g. ``"120px"``, ``"15%"``). Use when a column
   *  needs to be fixed-width (mono codes, numeric counters). */
  width?: string | number;
  align?: "left" | "center" | "right";
  /** Render the cell in JetBrains Mono. */
  mono?: boolean;
  /** Render the cell text in ``text.secondary`` instead of primary. */
  muted?: boolean;
  /** Allow the cell to wrap onto multiple lines. Default is nowrap. */
  wrap?: boolean;
  render?: (row: T) => ReactNode;
}

interface AdminTableProps<T> {
  columns: AdminTableColumn<T>[];
  rows: T[] | undefined;
  /** Row identity. String key (object property) or a function
   *  returning a unique string for each row. */
  rowKey: keyof T | ((row: T) => string);
  density?: TableDensity;
  loading?: boolean;
  /** Error message shown above the table; pair with ``onRetry``
   *  to let the user reload without leaving the page. */
  error?: ReactNode;
  onRetry?: () => void;
  /** Custom empty state. Falls back to ``AdminEmptyState`` with a
   *  generic message. */
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
}

const ROW_HEIGHT: Record<TableDensity, number> = {
  comfortable: 72,
  compact: 52,
};
const HEADER_BG = "rgba(255,255,255,0.02)";
const HAIRLINE = "1px solid rgba(255,255,255,0.08)";
const PAD_X = 24;

/**
 * Generic data table used across the admin panel.
 *
 * Built-in handling for the four states tables almost always need
 * (data / loading / error / empty) so each page doesn't reinvent
 * the wrapper. Columns are described declaratively via the
 * ``AdminTableColumn`` shape so the same primitive renders movies,
 * users, scans, etc.
 *
 * The generic type ``T`` flows from the ``rows`` prop, giving the
 * ``render`` callback strong typing without forcing callers to
 * spell out ``AdminTableColumn<Movie>`` on every column literal.
 */
export function AdminTable<T>({
  columns,
  rows,
  rowKey,
  density = "comfortable",
  loading,
  error,
  onRetry,
  emptyState,
  onRowClick,
}: AdminTableProps<T>) {
  const { t } = useTranslation();

  if (loading) {
    return <TableLoadingState columns={columns} density={density} />;
  }

  if (error) {
    return <TableErrorState message={error} onRetry={onRetry} />;
  }

  if (!rows || rows.length === 0) {
    return emptyState ?? (
      <AdminEmptyState
        title={t("admin.table.emptyTitle", "No results")}
        body={t("admin.table.emptyBody", "Nothing to show right now.")}
      />
    );
  }

  const getKey = (row: T, idx: number): string => {
    if (typeof rowKey === "function") return rowKey(row);
    return String(row[rowKey] ?? idx);
  };

  return (
    <TableContainer
      sx={{
        bgcolor: "rgba(255,255,255,0.015)",
        border: HAIRLINE,
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Table sx={{ borderCollapse: "collapse" }}>
        <TableHead>
          <TableRow sx={{ bgcolor: HEADER_BG }}>
            {columns.map((c) => (
              <TableCell
                key={c.id}
                scope="col"
                align={c.align ?? "left"}
                sx={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                  fontWeight: 500,
                  py: 1.75,
                  px: `${PAD_X}px`,
                  borderBottom: HAIRLINE,
                  width: c.width,
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, idx) => (
            <TableRow
              key={getKey(row, idx)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={{
                height: ROW_HEIGHT[density],
                transition: "background-color 100ms ease",
                cursor: onRowClick ? "pointer" : "default",
                "&:not(:last-of-type) td": { borderBottom: HAIRLINE },
                "&:hover": onRowClick
                  ? { bgcolor: "rgba(255,255,255,0.03)" }
                  : {},
              }}
            >
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  align={c.align ?? "left"}
                  sx={{
                    py: 0,
                    px: `${PAD_X}px`,
                    fontSize: "0.875rem",
                    color: c.muted ? "text.secondary" : "text.primary",
                    fontFamily: c.mono
                      ? "'JetBrains Mono', ui-monospace, monospace"
                      : "inherit",
                    width: c.width,
                    whiteSpace: c.wrap ? "normal" : "nowrap",
                    verticalAlign: "middle",
                    borderBottom: "none",
                  }}
                >
                  {c.render ? c.render(row) : ((row as Record<string, ReactNode>)[c.id] ?? null)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TableLoadingState<T>({
  columns,
  density,
}: {
  columns: AdminTableColumn<T>[];
  density: TableDensity;
}) {
  const rowH = ROW_HEIGHT[density];
  return (
    <TableContainer
      sx={{
        bgcolor: "rgba(255,255,255,0.015)",
        border: HAIRLINE,
        borderRadius: 1,
        overflow: "hidden",
      }}
    >
      <Table>
        <TableHead>
          <TableRow sx={{ bgcolor: HEADER_BG }}>
            {columns.map((c) => (
              <TableCell
                key={c.id}
                scope="col"
                sx={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: "0.6875rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "text.secondary",
                  fontWeight: 500,
                  py: 1.75,
                  px: `${PAD_X}px`,
                  borderBottom: HAIRLINE,
                  whiteSpace: "nowrap",
                }}
              >
                {c.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Array.from({ length: 5 }).map((_, idx) => (
            <TableRow
              key={idx}
              sx={{
                height: rowH,
                "&:not(:last-of-type) td": { borderBottom: HAIRLINE },
              }}
            >
              {columns.map((c) => (
                <TableCell
                  key={c.id}
                  sx={{ py: 0, px: `${PAD_X}px`, borderBottom: "none" }}
                >
                  <Skeleton
                    variant="rectangular"
                    width={c.width ? "60%" : "70%"}
                    height={14}
                    sx={{ borderRadius: 0.5 }}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function TableErrorState({
  message,
  onRetry,
}: {
  message: ReactNode;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        py: 2.5,
        px: 2.5,
        bgcolor: "rgba(220,80,70,0.06)",
        border: "1px solid rgba(220,80,70,0.25)",
        borderRadius: 1,
        color: "#ff8a7a",
      }}
    >
      <AlertTriangle size={20} aria-hidden />
      <Typography variant="body2" sx={{ flex: 1, color: "text.primary" }}>
        {message}
      </Typography>
      {onRetry && (
        <AdminButton onClick={onRetry} variant="secondary">
          {t("admin.table.retry", "Retry")}
        </AdminButton>
      )}
    </Box>
  );
}
