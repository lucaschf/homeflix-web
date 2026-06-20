// Admin primitives — single barrel so pages import from one path.
//
// Add new primitives here as they land. Components from earlier
// PRs (TmdbSuggestionsDialog, PromoteToSeriesConfirmDialog) keep
// their direct imports; they'll fold in as we refactor them on
// top of the new primitives in later phases.

export { AdminBadge, type BadgeTone } from "./AdminBadge";
export { AdminButton } from "./AdminButton";
export { AdminCard, AdminCardHeader } from "./AdminCard";
export { AdminConfirmDialog } from "./AdminConfirmDialog";
export { AdminDialog } from "./AdminDialog";
export { AdminEmptyState } from "./AdminEmptyState";
export { CreditsMarkerEditor } from "./CreditsMarkerEditor";
export { AdminFormSection } from "./AdminFormSection";
export { AdminInput } from "./AdminInput";
export { AdminLayout } from "./AdminLayout";
export { AdminPageHeader } from "./AdminPageHeader";
export { AdminSelect } from "./AdminSelect";
export { AdminSidebar } from "./AdminSidebar";
export {
  AdminTable,
  type AdminTableColumn,
  type TableDensity,
} from "./AdminTable";
export { AdminTablePagination } from "./AdminTablePagination";
export { AdminToolbar, FilterChip, ToolbarSearch } from "./AdminToolbar";
export { AdminTopbar } from "./AdminTopbar";
export { HypothesisChip } from "./HypothesisChip";
export { StatCard } from "./StatCard";
