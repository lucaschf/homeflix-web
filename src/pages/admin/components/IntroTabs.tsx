import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { AdminTabs } from "../../../components/admin";

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
    <AdminTabs
      tabs={TABS.map((tab) => ({
        key: tab.to,
        label: t(tab.labelKey),
        to: tab.to,
        active: tab.to === RUNS_PATH ? onRuns : !onRuns,
      }))}
    />
  );
}
