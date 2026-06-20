import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { AdminTabs } from "../../../components/admin";

const SERIES_PATH = "/admin/catalog/review/series";

const TABS: { to: string; labelKey: string }[] = [
  { to: "/admin/catalog/review", labelKey: "admin.nav.movies" },
  { to: SERIES_PATH, labelKey: "admin.nav.series" },
];

/**
 * Tab bar shared by the two review queues (movies + series), so they
 * live under a single sidebar entry. The series path activates the
 * "series" tab; every other review path falls back to "movies".
 */
export function ReviewTabs() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const onSeries = pathname.startsWith(SERIES_PATH);

  return (
    <AdminTabs
      tabs={TABS.map((tab) => ({
        key: tab.to,
        label: t(tab.labelKey),
        to: tab.to,
        active: tab.to === SERIES_PATH ? onSeries : !onSeries,
      }))}
    />
  );
}
