import { Alert, Box, CircularProgress, Grid, Snackbar, Stack, Typography } from "@mui/material";
import { Rows3, SquareSplitHorizontal } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAdminSettings } from "../../api/hooks";
import type { AdminSettingDetail, AdminSettingKey } from "../../api/types";
import {
  AdminButton,
  AdminCard,
  AdminPageHeader,
  type FormDensity,
  FormDensityContext,
  SegmentedControl,
} from "../../components/admin";
import { useDocumentTitle } from "../../hooks/useDocumentTitle";
import { whiteAlpha, toastSurfaceSx } from "../../theme/tokens";
import { SettingsAccordionLayout } from "./components/SettingsAccordionLayout";
import { SettingsRailLayout } from "./components/SettingsRailLayout";
import { SETTINGS_SECTIONS } from "./components/settingsSections";

type Snack = { message: string; severity: "success" | "error" } | null;
type SettingsView = "rail" | "accordion";

const VIEW_STORAGE_KEY = "homeflix.admin.settings.view";
const DENSITY_STORAGE_KEY = "homeflix.admin.settings.density";

function readStored<T extends string>(key: string, allowed: T[], fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw && (allowed as string[]).includes(raw)) return raw as T;
  } catch {
    /* localStorage unavailable (private mode / SSR) — use the default */
  }
  return fallback;
}

function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* ignore quota / availability errors — the choice just isn't persisted */
  }
}

function detailFor(
  details: AdminSettingDetail[],
  key: AdminSettingKey,
): AdminSettingDetail | undefined {
  return details.find((d) => d.key === key);
}

/**
 * Runtime-settings admin page (ADR-013).
 *
 * Redesigned to show one section at a time — a section rail (default)
 * or an accordion — instead of the previous vertical stack of every
 * bucket. A VISTA switch flips between the two structures and a
 * DENSIDADE switch tightens the row rhythm; both choices persist per
 * operator in ``localStorage``. A search box filters the sections
 * and the active/open section deep-links to the URL hash.
 *
 * The page does the single ``GET /admin/settings`` round-trip and
 * hands each bucket's ``AdminSettingDetail`` slice to its typed card
 * (via ``SettingsCardSwitch``). Every card stays mounted regardless
 * of which section is visible, so unsaved edits and the dirty dot
 * survive navigation between sections. Each card lifts its dirty
 * flag up through ``SettingsSectionContext`` so the rail/accordion
 * can render the unsaved-edits marker.
 */
export function SettingsAdmin() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.settings.title"));

  const { data, isLoading, isError, refetch } = useAdminSettings();
  const [snack, setSnack] = useState<Snack>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<SettingsView>(() =>
    readStored<SettingsView>(VIEW_STORAGE_KEY, ["rail", "accordion"], "rail"),
  );
  const [density, setDensity] = useState<FormDensity>(() =>
    readStored<FormDensity>(DENSITY_STORAGE_KEY, ["comfortable", "compact"], "comfortable"),
  );
  const [dirtyMap, setDirtyMap] = useState<Record<string, boolean>>({});

  const notifySuccess = (message: string) => setSnack({ message, severity: "success" });
  const notifyError = (message: string) => setSnack({ message, severity: "error" });

  const onView = (next: SettingsView) => {
    setView(next);
    writeStored(VIEW_STORAGE_KEY, next);
  };
  const onDensity = (next: FormDensity) => {
    setDensity(next);
    writeStored(DENSITY_STORAGE_KEY, next);
  };

  // Stable per-section dirty reporter so the card's report effect
  // isn't re-fired on every parent render.
  const reporters = useRef(new Map<string, (dirty: boolean) => void>());
  const reportDirty = useCallback((id: string) => {
    let fn = reporters.current.get(id);
    if (!fn) {
      fn = (dirty: boolean) =>
        setDirtyMap((m) => (m[id] === dirty ? m : { ...m, [id]: dirty }));
      reporters.current.set(id, fn);
    }
    return fn;
  }, []);

  const sections = useMemo(() => {
    if (!data) return [];
    return SETTINGS_SECTIONS.map((meta) => {
      const detail = detailFor(data, meta.id);
      return detail ? { meta, detail } : null;
    }).filter((s): s is { meta: (typeof SETTINGS_SECTIONS)[number]; detail: AdminSettingDetail } =>
      s !== null,
    );
  }, [data]);

  const header = (
    <AdminPageHeader
      breadcrumb={[t("admin.nav.group.system"), t("admin.nav.settings")]}
      title={t("admin.settings.title")}
      subtitle={t("admin.settings.subtitle")}
      primaryCTA={
        <Grid
          container
          spacing={{ xs: 1.5, sm: 2 }}
          sx={{ width: { xs: "100%", md: "auto" }, alignItems: "center" }}
        >
          <Grid size={{ xs: 12, sm: "auto" }}>
            <SegmentedControl<SettingsView>
              label={t("admin.settings.view.label")}
              ariaLabel={t("admin.settings.view.label")}
              value={view}
              onChange={onView}
              options={[
                {
                  value: "rail",
                  label: t("admin.settings.view.rail"),
                  title: t("admin.settings.view.railHint"),
                  icon: <SquareSplitHorizontal size={13} aria-hidden />,
                },
                {
                  value: "accordion",
                  label: t("admin.settings.view.accordion"),
                  title: t("admin.settings.view.accordionHint"),
                  icon: <Rows3 size={13} aria-hidden />,
                },
              ]}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: "auto" }}>
            <SegmentedControl<FormDensity>
              label={t("admin.settings.density.label")}
              ariaLabel={t("admin.settings.density.label")}
              value={density}
              onChange={onDensity}
              options={[
                { value: "comfortable", label: t("admin.settings.density.comfortable") },
                { value: "compact", label: t("admin.settings.density.compact") },
              ]}
            />
          </Grid>
        </Grid>
      }
    />
  );

  if (isLoading && !data) {
    return (
      <>
        {header}
        <AdminCard>
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress size={22} color="primary" />
          </Box>
        </AdminCard>
      </>
    );
  }

  if (isError || !data) {
    return (
      <>
        {header}
        <AdminCard>
          <Stack alignItems="center" spacing={1.5} sx={{ py: 5 }}>
            <Typography variant="body2" color="error">
              {t("admin.settings.errorLoading")}
            </Typography>
            <AdminButton variant="secondary" onClick={() => void refetch()}>
              {t("admin.table.retry")}
            </AdminButton>
          </Stack>
        </AdminCard>
      </>
    );
  }

  const layoutProps = {
    sections,
    dirtyMap,
    reportDirty,
    query,
    onQueryChange: setQuery,
    onSuccess: notifySuccess,
    onError: notifyError,
  };

  return (
    <>
      {header}

      <Alert
        severity="info"
        variant="outlined"
        sx={{
          mb: 3,
          bgcolor: whiteAlpha(0.015),
          borderColor: whiteAlpha(0.08),
          color: "text.secondary",
          "& .MuiAlert-icon": { color: "primary.main" },
        }}
      >
        {t("admin.settings.propagationNote")}
      </Alert>

      <FormDensityContext.Provider value={density}>
        {view === "rail" ? (
          <SettingsRailLayout {...layoutProps} />
        ) : (
          <SettingsAccordionLayout {...layoutProps} />
        )}
      </FormDensityContext.Provider>

      <Snackbar
        open={!!snack}
        autoHideDuration={4000}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        {snack ? (
          <Box
            sx={{
              ...toastSurfaceSx(snack.severity),
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
            }}
          >
            {snack.message}
          </Box>
        ) : undefined}
      </Snackbar>
    </>
  );
}
