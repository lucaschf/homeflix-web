import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { peach } from "../../../theme/colors";
import { inkAlpha, whiteAlpha } from "../../../theme/tokens";

const RUNS_PATH = "/admin/intros/runs";

const TABS: { to: string; labelKey: string }[] = [
  { to: "/admin/intros", labelKey: "admin.intros.tabs.manage" },
  { to: RUNS_PATH, labelKey: "admin.intros.tabs.runs" },
];

/**
 * Tab bar shared by the two intro admin views (manage markers + the
 * detection-run history), so they live under a single sidebar entry.
 * The "manage" tab stays active across its drill-down (the per-episode
 * editor at ``/admin/intros/:seriesId/:season/:episode``); only the
 * runs path activates the "runs" tab.
 */
export function IntroTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const onRuns = pathname.startsWith(RUNS_PATH);

  return (
    <Box
      sx={{
        display: "flex",
        gap: 0.5,
        borderBottom: `1px solid ${whiteAlpha(0.08)}`,
      }}
    >
      {TABS.map((tab) => {
        const active = tab.to === RUNS_PATH ? onRuns : !onRuns;
        return (
          <Box
            key={tab.to}
            component={Link}
            to={tab.to}
            sx={{
              px: 1.75,
              py: 1,
              fontSize: "0.8125rem",
              fontWeight: 500,
              color: active ? peach.main : inkAlpha(0.65),
              textDecoration: "none",
              borderBottom: "2px solid",
              borderColor: active ? peach.main : "transparent",
              marginBottom: "-1px",
              transition: "color 120ms ease, border-color 120ms ease",
              "&:hover": { color: active ? peach.main : "text.primary" },
            }}
          >
            {t(tab.labelKey)}
          </Box>
        );
      })}
    </Box>
  );
}
