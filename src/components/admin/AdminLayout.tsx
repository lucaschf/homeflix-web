import { Box } from "@mui/material";
import { useState } from "react";
import { Outlet } from "react-router-dom";
import { AdminSidebar } from "./AdminSidebar";
import { AdminTopbar } from "./AdminTopbar";
import {
  type TableDensity,
} from "./AdminTable";

// Storage keys used for the operator's persistent shell preferences.
const COLLAPSED_KEY = "homeflix.admin.sidebar.collapsed";
const DENSITY_KEY = "homeflix.admin.density";

function readBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    return raw === "1" || raw === "true";
  } catch {
    return fallback;
  }
}

function readDensity(fallback: TableDensity): TableDensity {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(DENSITY_KEY);
    return raw === "compact" ? "compact" : "comfortable";
  } catch {
    return fallback;
  }
}

/**
 * Grid shell that wraps every ``/admin/*`` route. Three regions:
 * sidebar (left), topbar (top right), main content (under topbar).
 *
 * Holds two persistent operator preferences in ``localStorage``:
 *
 * - ``sidebar.collapsed`` — toggled from the topbar; flips the rail
 *   between 240 px (full) and 64 px (icon-only).
 * - ``density`` — drives the ``data-density`` attribute on ``<main>``
 *   so descendant tables can opt into the compact 40 px row layout.
 *   The actual toggle UI ships in a later phase; for now the
 *   preference reads from storage and components that opt in
 *   (``AdminTable``) accept density as a prop.
 *
 * The shell exposes no React context yet — pages that need density
 * read it via ``useAdminDensity`` (TBD when the first page actually
 * needs it). Keeps the surface small for P0.
 */
export function AdminLayout() {
  const [collapsed, setCollapsed] = useState<boolean>(() =>
    readBoolean(COLLAPSED_KEY, false),
  );
  const [density] = useState<TableDensity>(() => readDensity("comfortable"));

  const onToggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* ignore quota / private-mode errors */
      }
      return next;
    });
  };

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: `${collapsed ? 64 : 240}px 1fr`,
        gridTemplateRows: "auto 1fr",
        gridTemplateAreas: '"sidebar topbar" "sidebar main"',
        height: "100vh",
        bgcolor: "background.default",
        color: "text.primary",
        overflow: "hidden",
        transition: "grid-template-columns 220ms ease",
      }}
    >
      <Box sx={{ gridArea: "sidebar", overflow: "hidden" }}>
        <AdminSidebar collapsed={collapsed} />
      </Box>
      <Box sx={{ gridArea: "topbar" }}>
        <AdminTopbar collapsed={collapsed} onToggleCollapsed={onToggleCollapsed} />
      </Box>
      <Box
        component="main"
        data-density={density}
        sx={{
          gridArea: "main",
          overflow: "auto",
          px: { xs: 3, md: 5 },
          pt: 3,
          pb: 8,
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}
