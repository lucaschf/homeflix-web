import { useMemo, useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Menu,
  MenuItem,
  TextField,
  Typography,
} from "@mui/material";
import {
  AlertTriangle,
  Bookmark,
  ChevronRight,
  GripVertical,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Share2,
  Shuffle,
  UserMinus,
  Users,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useCreateCustomList,
  useCustomListItems,
  useCustomLists,
  useDeleteCustomList,
  useRemoveItemFromCustomList,
  useRenameCustomList,
  useReorderCustomListItems,
  useToggleWatchlist,
  useUnfollowList,
  useWatchlist,
} from "../api/hooks";
import { SHARE_ENABLED } from "../config/featureFlags";
import { ShareListDialog } from "../components/lists/ShareListDialog";
import type { CustomListOutput, WatchlistItemOutput } from "../api/types";
import { MediaCard } from "../components/MediaCard";
import { AdminButton } from "../components/admin/AdminButton";
import { AdminConfirmDialog } from "../components/admin/AdminConfirmDialog";
import { AdminTabs } from "../components/admin/AdminTabs";
import { FancyEmpty } from "../components/admin/FancyEmpty";
import { AddTitlesDialog } from "../components/lists/AddTitlesDialog";
import { CreateListCard } from "../components/lists/CreateListCard";
import { ListCard } from "../components/lists/ListCard";
import { QueueCard } from "../components/lists/QueueCard";
import { QueueToolbar, type QueueSort } from "../components/lists/QueueToolbar";
import { SortMenuButton } from "../components/lists/SortMenuButton";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { peach } from "../theme/colors";
import { fontFamily, inkAlpha, peachAlpha, whiteAlpha } from "../theme/tokens";
import { formatRelativeServerTime } from "../utils/datetime";
import { formatDuration } from "../utils/duration";
import { mediaQuality } from "../utils/quality";

const MAX_LISTS = 10;

/** Mono count pill rendered inside each tab label. */
function CountPill({ count, active }: { count: number; active: boolean }) {
  return (
    <Box
      component="span"
      sx={{
        fontFamily: fontFamily.mono,
        fontSize: 11,
        px: 0.9,
        py: "2px",
        borderRadius: 20,
        bgcolor: active ? peachAlpha(0.16) : whiteAlpha(0.05),
        color: active ? "primary.main" : "text.secondary",
      }}
    >
      {count}
    </Box>
  );
}

/** Open a media item's detail page. */
function useMediaNav() {
  const navigate = useNavigate();
  return {
    open: (mediaId: string, mediaType: "movie" | "series") =>
      navigate(mediaType === "movie" ? `/movie/${mediaId}` : `/series/${mediaId}`),
    play: (mediaId: string, mediaType: "movie" | "series") =>
      // Series can't be played directly (needs a season/episode), so fall
      // back to the detail page where the user resumes/picks an episode.
      navigate(mediaType === "movie" ? `/play/movie/${mediaId}` : `/series/${mediaId}`),
  };
}

// ── Watchlist Tab (Fila) ─────────────────────────────────

function WatchlistTab() {
  const { t } = useTranslation();
  const nav = useMediaNav();
  const toggleWatchlist = useToggleWatchlist();
  const { data: items, isLoading, isError, refetch } = useWatchlist();
  const [sort, setSort] = useState<QueueSort>("recent");

  const sorted = useMemo(() => {
    const list = [...(items ?? [])];
    if (sort === "title") {
      list.sort((a, b) => a.title.localeCompare(b.title));
    }
    // "recent" keeps the server order (added_at desc).
    return list;
  }, [items, sort]);

  if (isLoading) return <CenteredSpinner />;
  if (isError) return <ListErrorState onRetry={() => refetch()} />;

  if (!items?.length) {
    return (
      <FancyEmpty
        icon={Bookmark}
        motif="cards"
        title={t("lists.empty")}
        body={t("lists.emptyHint")}
      />
    );
  }

  const remove = (item: WatchlistItemOutput) =>
    toggleWatchlist.mutate({ media_id: item.media_id, media_type: item.media_type });

  const playQueue = () => {
    const first = sorted[0];
    if (first) nav.play(first.media_id, first.media_type);
  };

  const shuffle = () => {
    const pick = sorted[Math.floor(Math.random() * sorted.length)];
    if (pick) nav.play(pick.media_id, pick.media_type);
  };

  const totalRuntime =
    formatDuration(sorted.reduce((acc, i) => acc + (i.runtime_seconds ?? 0), 0)) || undefined;

  return (
    <>
      <QueueToolbar
        totalRuntime={totalRuntime}
        sort={sort}
        onSortChange={setSort}
        onShuffle={shuffle}
        onPlayQueue={playQueue}
      />
      <Box
        sx={{
          display: "grid",
          // Match the Home carousel card width at each breakpoint
          // (MediaCard default: xs 140 / sm 200 / md 240 / lg 280).
          gridTemplateColumns: {
            xs: "repeat(auto-fill, minmax(140px, 1fr))",
            sm: "repeat(auto-fill, minmax(200px, 1fr))",
            md: "repeat(auto-fill, minmax(240px, 1fr))",
            lg: "repeat(auto-fill, minmax(280px, 1fr))",
          },
          columnGap: { xs: 1.5, md: 2.5 },
          rowGap: { xs: 2.5, md: 3.5 },
        }}
      >
        {sorted.map((item, index) => {
          const q = mediaQuality(item.resolution, item.hdr);
          return (
            <QueueCard
              key={item.media_id}
              item={{
                media_id: item.media_id,
                media_type: item.media_type,
                title: item.title,
                poster_path: item.poster_path,
                year: item.year ?? undefined,
                runtime: formatDuration(item.runtime_seconds) || undefined,
                genre: item.genres?.[0],
                qualityLabel: q?.label,
                qualityKind: q?.kind,
                progress: item.progress ?? undefined,
              }}
              index={index}
              onOpen={() => nav.open(item.media_id, item.media_type)}
              onPlay={() => nav.play(item.media_id, item.media_type)}
              onRemove={() => remove(item)}
            />
          );
        })}
      </Box>
    </>
  );
}

// ── Custom Lists Tab ─────────────────────────────────────

type ActiveDialog =
  | { type: "create" }
  | { type: "rename"; list: CustomListOutput }
  | { type: "delete"; list: CustomListOutput }
  | null;

function CustomListsTab({ onSelectList }: { onSelectList: (list: CustomListOutput) => void }) {
  const { t } = useTranslation();
  const { data: lists, isLoading, isError, refetch } = useCustomLists();
  const [activeDialog, setActiveDialog] = useState<ActiveDialog>(null);

  if (isLoading) return <CenteredSpinner />;
  if (isError) return <ListErrorState onRetry={() => refetch()} />;

  const count = lists?.length ?? 0;

  return (
    <>
      {count > 0 ? (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 2,
              mb: 2.75,
            }}
          >
            <Typography variant="body2" color="text.secondary">
              {t("lists.listCount", { count, max: MAX_LISTS })}
            </Typography>
            <AdminButton
              variant="primary"
              icon={<Plus size={15} />}
              disabled={count >= MAX_LISTS}
              onClick={() => setActiveDialog({ type: "create" })}
            >
              {t("lists.newList")}
            </AdminButton>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(auto-fill, minmax(200px, 1fr))",
                md: "repeat(auto-fill, minmax(240px, 1fr))",
              },
              columnGap: { xs: 2, md: 2.75 },
              rowGap: { xs: 3, md: 3.75 },
            }}
          >
            {lists!.map((list) => (
              <ListCard
                key={list.id}
                list={list}
                onOpen={() => onSelectList(list)}
                onPlay={() => onSelectList(list)}
                onRename={() => setActiveDialog({ type: "rename", list })}
                onDelete={() => setActiveDialog({ type: "delete", list })}
              />
            ))}
            {count < MAX_LISTS && (
              <CreateListCard onClick={() => setActiveDialog({ type: "create" })} />
            )}
          </Box>
        </>
      ) : (
        <FancyEmpty
          icon={Bookmark}
          motif="orbit"
          title={t("lists.customListsEmpty")}
          body={t("lists.customListsEmptyHint")}
          primary={
            <AdminButton
              variant="primary"
              icon={<Plus size={15} />}
              onClick={() => setActiveDialog({ type: "create" })}
            >
              {t("lists.createFirstList")}
            </AdminButton>
          }
        />
      )}

      {activeDialog?.type === "create" && (
        <CreateListDialog
          listCount={count}
          open
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog?.type === "rename" && (
        <RenameListDialog
          key={activeDialog.list.id}
          list={activeDialog.list}
          open
          onClose={() => setActiveDialog(null)}
        />
      )}
      {activeDialog?.type === "delete" && (
        <DeleteListDialog list={activeDialog.list} open onClose={() => setActiveDialog(null)} />
      )}
    </>
  );
}

// ── Custom List Detail ───────────────────────────────────

type ListSort = "manual" | "recent" | "title";

/** Mono-eyebrow stat block (label over value), matching the ComingSoon
 *  intro stats. ``sub`` is an optional muted line below the value. */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Box>
      <Typography variant="eyebrow" sx={{ color: "text.secondary", display: "block" }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.5, fontSize: "1.05rem", fontWeight: 600 }}>{value}</Typography>
      {sub && (
        <Typography sx={{ mt: 0.25, fontSize: "0.7rem", color: "text.secondary" }}>{sub}</Typography>
      )}
    </Box>
  );
}

function formatMonthYear(iso: string, locale: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric" }).format(d);
}

function CustomListDetail({ list, onBack }: { list: CustomListOutput; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const nav = useMediaNav();
  const { data: lists } = useCustomLists();
  const current = lists?.find((l) => l.id === list.id) ?? list;
  const { data: items, isLoading, isError, refetch } = useCustomListItems(list.id);
  const removeItem = useRemoveItemFromCustomList();
  const reorder = useReorderCustomListItems();
  const unfollow = useUnfollowList();

  // Manual drag order overlaid on the server order; reset once the
  // server returns the persisted order after a reorder.
  const [manualOrder, setManualOrder] = useState<string[] | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [sort, setSort] = useState<ListSort>("manual");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [dialog, setDialog] = useState<"rename" | "delete" | "share" | null>(null);

  // A followed list is read-only: the follower can play/shuffle but can't
  // add, remove, reorder, rename, delete or share it — only unfollow.
  const readOnly = !!current.is_followed;

  const count = items?.length ?? current.item_count;
  const updated = formatRelativeServerTime(current.updated_at, i18n.language);
  const created = formatMonthYear(current.created_at, i18n.language);
  const totalRuntime =
    formatDuration((items ?? []).reduce((acc, i) => acc + (i.runtime_seconds ?? 0), 0)) || null;
  // "Watched" = items past the ~90% completion mark (movies only carry
  // progress; series report none).
  const watched = (items ?? []).filter((i) => (i.progress ?? 0) >= 0.9).length;

  // Server order key — when it changes (after a persisted reorder),
  // drop the local override so the server becomes authoritative again.
  // Adjusting state during render is the idiomatic reset-on-prop-change.
  const itemsKey = (items ?? []).map((i) => i.media_id).join(",");
  const [orderKey, setOrderKey] = useState(itemsKey);
  if (orderKey !== itemsKey) {
    setOrderKey(itemsKey);
    setManualOrder(null);
  }

  const ordered = useMemo(() => {
    const arr = [...(items ?? [])];
    if (manualOrder) {
      const idx = new Map(manualOrder.map((id, i) => [id, i]));
      arr.sort((a, b) => (idx.get(a.media_id) ?? 0) - (idx.get(b.media_id) ?? 0));
      return arr;
    }
    if (sort === "title") arr.sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === "recent") arr.sort((a, b) => (b.added_at ?? "").localeCompare(a.added_at ?? ""));
    return arr; // "manual" keeps the server position order
  }, [items, sort, manualOrder]);

  const handleDragStart = (id: string) => {
    if (readOnly) return; // followed lists can't be reordered
    setDraggingId(id);
    setManualOrder(ordered.map((i) => i.media_id)); // snapshot current order
  };
  const handleDragEnter = (overId: string) => {
    const from = draggingId;
    if (!from || from === overId) return;
    setManualOrder((prev) => {
      if (!prev) return prev;
      const ids = prev.slice();
      const f = ids.indexOf(from);
      const o = ids.indexOf(overId);
      if (f < 0 || o < 0) return prev;
      ids.splice(f, 1);
      ids.splice(o, 0, from);
      return ids;
    });
  };
  const handleDragEnd = () => {
    if (draggingId && manualOrder) {
      if (sort !== "manual") setSort("manual");
      reorder.mutate({ listId: list.id, mediaIds: manualOrder });
    }
    setDraggingId(null);
  };

  const sortLabels: Record<ListSort, string> = {
    manual: t("lists.sortManual"),
    recent: t("lists.sortRecent"),
    title: t("lists.sortTitle"),
  };

  const playFrom = (list: typeof ordered) => {
    const first = list[0];
    if (first) nav.play(first.media_id, first.media_type);
  };

  return (
    <Box>
      {/* Intro: title + description + stats (left) | actions (right) */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 3,
          mb: 3.5,
        }}
      >
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography
            variant="pageTitle"
            sx={{
              fontSize: { xs: "2.1rem", md: "3rem" },
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {current.name}
          </Typography>
          {current.description && (
            <Typography
              variant="pageSubtitle"
              sx={{ mt: 1.5, color: inkAlpha(0.55), width: "100%", maxWidth: { xs: "100%", lg: "50%" } }}
            >
              {current.description}
            </Typography>
          )}
          {readOnly && (
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.75,
                mt: 1.5,
                px: 1,
                py: 0.4,
                borderRadius: 20,
                bgcolor: peachAlpha(0.12),
                color: "primary.main",
              }}
            >
              <Users size={13} />
              <Typography sx={{ fontSize: "0.72rem", fontWeight: 600 }}>
                {current.owner_name
                  ? `${t("lists.share.following")} · ${t("lists.share.followedBy", { name: current.owner_name })}`
                  : t("lists.share.following")}
              </Typography>
            </Box>
          )}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 4, mt: 3 }}>
            <Stat label={t("lists.titlesLabel")} value={String(count)} />
            {totalRuntime && (
              <Stat label={t("lists.totalRuntimeLabel")} value={totalRuntime} />
            )}
            {count > 0 && (
              <Stat label={t("lists.watchedLabel")} value={`${watched} / ${count}`} />
            )}
            {updated && (
              <Stat
                label={t("lists.updatedLabel")}
                value={updated}
                sub={created ? t("lists.createdAt", { date: created }) : undefined}
              />
            )}
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexShrink: 0 }}>
          <AdminButton
            variant="primary"
            icon={<Play size={14} fill="currentColor" />}
            onClick={() => playFrom(ordered)}
            disabled={!count}
          >
            {t("lists.playAll")}
          </AdminButton>
          <AdminButton
            variant="secondary"
            icon={<Shuffle size={15} />}
            onClick={() => playFrom([...ordered].sort(() => Math.random() - 0.5))}
            disabled={!count}
          >
            {t("lists.shuffle")}
          </AdminButton>
          {readOnly ? (
            <AdminButton
              variant="secondary"
              icon={<UserMinus size={15} />}
              onClick={() => unfollow.mutate(list.id, { onSuccess: onBack })}
              disabled={unfollow.isPending}
            >
              {t("lists.share.unfollow")}
            </AdminButton>
          ) : (
            <>
              <AdminButton
                variant="secondary"
                aria-label={t("lists.editList")}
                onClick={() => setDialog("rename")}
                sx={{ minWidth: 0, px: 1, alignSelf: "stretch" }}
              >
                <Pencil size={16} />
              </AdminButton>
              <AdminButton
                variant="secondary"
                aria-label={t("lists.moreOptions")}
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                sx={{ minWidth: 0, px: 1, alignSelf: "stretch" }}
              >
                <MoreVertical size={16} />
              </AdminButton>
            </>
          )}
        </Box>
      </Box>

      {/* Toolbar: add titles | sort + view */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 1.5,
          mb: 2.75,
        }}
      >
        {readOnly ? (
          <Typography variant="body2" color="text.secondary">
            {t("lists.share.readOnly")}
          </Typography>
        ) : (
          <AdminButton
            variant="secondary"
            icon={<Plus size={15} />}
            onClick={() => setAddOpen(true)}
          >
            {t("lists.addTitles")}
          </AdminButton>
        )}

        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <SortMenuButton
            label={t("lists.sortLabel")}
            value={sort}
            options={(Object.keys(sortLabels) as ListSort[]).map((key) => ({
              key,
              label: sortLabels[key],
            }))}
            onChange={setSort}
          />

          <Box sx={{ display: "flex", border: `1px solid ${whiteAlpha(0.08)}`, borderRadius: 1, overflow: "hidden" }}>
            {(["grid", "list"] as const).map((v) => (
              <IconButton
                key={v}
                aria-label={t(v === "grid" ? "lists.viewGrid" : "lists.viewList")}
                onClick={() => setView(v)}
                sx={{
                  borderRadius: 0,
                  color: view === v ? "primary.main" : "text.secondary",
                  bgcolor: view === v ? peachAlpha(0.1) : "transparent",
                }}
              >
                {v === "grid" ? <LayoutGrid size={16} /> : <List size={16} />}
              </IconButton>
            ))}
          </Box>
        </Box>
      </Box>

      {isError ? (
        <ListErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <CenteredSpinner />
      ) : ordered.length ? (
        view === "grid" ? (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "repeat(auto-fill, minmax(140px, 1fr))",
                sm: "repeat(auto-fill, minmax(200px, 1fr))",
                md: "repeat(auto-fill, minmax(240px, 1fr))",
                lg: "repeat(auto-fill, minmax(280px, 1fr))",
              },
              columnGap: { xs: 1.5, md: 2.5 },
              rowGap: { xs: 2.5, md: 3.5 },
            }}
          >
            {ordered.map((item) => (
              <MediaCard
                key={item.media_id}
                title={item.title}
                imageUrl={item.poster_path ?? undefined}
                year={item.year ?? undefined}
                progress={item.progress != null ? Math.round(item.progress * 100) : undefined}
                variant="poster"
                fullWidth
                onClick={() => nav.open(item.media_id, item.media_type)}
                onDismiss={
                  readOnly
                    ? undefined
                    : () => removeItem.mutate({ listId: list.id, mediaId: item.media_id })
                }
              />
            ))}
          </Box>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {ordered.map((item, i) => (
              <ListRow
                key={item.media_id}
                index={i}
                title={item.title}
                posterPath={item.poster_path}
                readOnly={readOnly}
                dragging={draggingId === item.media_id}
                onDragStart={() => handleDragStart(item.media_id)}
                onDragEnter={() => handleDragEnter(item.media_id)}
                onDragEnd={handleDragEnd}
                onOpen={() => nav.open(item.media_id, item.media_type)}
                onRemove={
                  readOnly
                    ? undefined
                    : () => removeItem.mutate({ listId: list.id, mediaId: item.media_id })
                }
              />
            ))}
          </Box>
        )
      ) : (
        <FancyEmpty
          icon={Bookmark}
          motif="cards"
          title={t("lists.listItemsEmpty")}
          body={t("lists.listItemsEmptyHint")}
        />
      )}

      <Menu anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        {SHARE_ENABLED && (
          <MenuItem
            onClick={() => {
              setMenuAnchor(null);
              setDialog("share");
            }}
          >
            <Share2 size={15} style={{ marginRight: 8 }} />
            {t("lists.share.share")}
          </MenuItem>
        )}
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDialog("rename");
          }}
        >
          {t("lists.rename")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDialog("delete");
          }}
          sx={{ color: "error.main" }}
        >
          {t("lists.delete")}
        </MenuItem>
      </Menu>

      {dialog === "rename" && (
        <RenameListDialog list={current} open onClose={() => setDialog(null)} />
      )}
      {dialog === "delete" && (
        <DeleteListDialog
          list={current}
          open
          onClose={() => setDialog(null)}
          onDeleted={onBack}
        />
      )}
      {dialog === "share" && (
        <ShareListDialog listId={current.id} open onClose={() => setDialog(null)} />
      )}

      <AddTitlesDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        listId={list.id}
        existingIds={new Set(items?.map((i) => i.media_id) ?? [])}
      />
    </Box>
  );
}

/** Compact list-view row: index, small poster, title, remove. */
function ListRow({
  index,
  title,
  posterPath,
  readOnly,
  dragging,
  onDragStart,
  onDragEnter,
  onDragEnd,
  onOpen,
  onRemove,
}: {
  index: number;
  title: string;
  posterPath?: string | null;
  /** Followed-list row: not draggable, no remove control. */
  readOnly?: boolean;
  dragging?: boolean;
  onDragStart?: () => void;
  onDragEnter?: () => void;
  onDragEnd?: () => void;
  onOpen: () => void;
  onRemove?: () => void;
}) {
  return (
    <Box
      draggable={!readOnly}
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1,
        borderRadius: 1.5,
        cursor: "pointer",
        opacity: dragging ? 0.4 : 1,
        transition: "background-color 140ms, opacity 140ms",
        "&:hover": { bgcolor: whiteAlpha(0.04) },
        "&:hover .lr-remove": { opacity: 1 },
        "&:hover .lr-grip": { opacity: 0.7 },
      }}
    >
      {!readOnly && (
        <Box
          className="lr-grip"
          sx={{
            display: "flex",
            color: "text.secondary",
            cursor: "grab",
            opacity: { xs: 0.7, md: 0 },
            transition: "opacity 140ms",
          }}
        >
          <GripVertical size={16} />
        </Box>
      )}
      <Typography
        sx={{ width: 24, textAlign: "right", fontFamily: fontFamily.mono, fontSize: 12, color: "text.secondary" }}
      >
        {String(index + 1).padStart(2, "0")}
      </Typography>
      <Box
        sx={{
          width: 38,
          height: 57,
          borderRadius: 1,
          flexShrink: 0,
          bgcolor: whiteAlpha(0.04),
          ...(posterPath
            ? { backgroundImage: `url(${posterPath})`, backgroundSize: "cover", backgroundPosition: "center" }
            : {}),
        }}
      />
      <Typography sx={{ flex: 1, minWidth: 0, fontSize: "0.92rem", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {title}
      </Typography>
      {onRemove && (
        <IconButton
          className="lr-remove"
          size="small"
          aria-label="remove"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          sx={{ opacity: { xs: 1, md: 0 }, transition: "opacity 140ms", color: "text.secondary" }}
        >
          <X size={15} />
        </IconButton>
      )}
    </Box>
  );
}

// ── Create-list modal (rich) ─────────────────────────────

function CreateListDialog({
  listCount,
  open,
  onClose,
}: {
  listCount: number;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const createList = useCreateCustomList();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const trimmed = name.trim();

  const submit = () => {
    if (!trimmed) return;
    createList.mutate(
      { name: trimmed, description: description.trim() || null },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <Box sx={{ p: 3 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.75 }}>
          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: "9px",
              bgcolor: peachAlpha(0.14),
              color: "primary.main",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Bookmark size={18} fill={peach.main} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
              {t("lists.createList")}
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
              {t("lists.createListHelper")}
            </Typography>
          </Box>
        </Box>

        <TextField
          autoFocus
          fullWidth
          size="small"
          label={t("lists.listName")}
          placeholder={t("lists.listNamePlaceholder")}
          value={name}
          onChange={(e) => setName(e.target.value.slice(0, 40))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          slotProps={{ htmlInput: { maxLength: 40 } }}
        />
        <Box sx={{ display: "flex", justifyContent: "space-between", mt: 1 }}>
          <Typography sx={{ fontSize: "0.68rem", color: "text.secondary" }}>
            {t("lists.quotaUsed", { count: listCount, max: MAX_LISTS })}
          </Typography>
          <Typography sx={{ fontSize: "0.68rem", color: "text.secondary", fontFamily: fontFamily.mono }}>
            {name.length}/40
          </Typography>
        </Box>

        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          label={t("lists.descriptionLabel")}
          placeholder={t("lists.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          sx={{ mt: 2 }}
        />

        <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1.25, mt: 3 }}>
          <AdminButton variant="ghost" onClick={onClose}>
            {t("lists.cancel")}
          </AdminButton>
          <AdminButton variant="primary" onClick={submit} disabled={!trimmed || createList.isPending}>
            {t("lists.create")}
          </AdminButton>
        </Box>
      </Box>
    </Dialog>
  );
}

// ── Rename dialog ────────────────────────────────────────

function RenameListDialog({
  list,
  open,
  onClose,
}: {
  list: CustomListOutput;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const renameList = useRenameCustomList();
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? "");
  const trimmed = name.trim();
  const trimmedDesc = description.trim();

  const submit = () => {
    if (!trimmed) return;
    const unchanged = trimmed === list.name && trimmedDesc === (list.description ?? "");
    if (unchanged) {
      onClose();
      return;
    }
    renameList.mutate(
      { listId: list.id, name: trimmed, description: trimmedDesc || null },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("lists.editList")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          size="small"
          label={t("lists.listName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          sx={{ mt: 1 }}
        />
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          label={t("lists.descriptionLabel")}
          placeholder={t("lists.descriptionPlaceholder")}
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, 500))}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          sx={{ mt: 2 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="outlined">
          {t("lists.cancel")}
        </Button>
        <Button
          onClick={submit}
          color="primary"
          variant="contained"
          disabled={!trimmed || renameList.isPending}
        >
          {t("lists.save")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Delete dialog ────────────────────────────────────────

function DeleteListDialog({
  list,
  open,
  onClose,
  onDeleted,
}: {
  list: CustomListOutput;
  open: boolean;
  onClose: () => void;
  /** Fired after a successful delete (e.g. to leave the detail view). */
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const deleteList = useDeleteCustomList();

  return (
    <AdminConfirmDialog
      open={open}
      danger
      title={t("lists.delete")}
      body={t("lists.deleteConfirm")}
      busy={deleteList.isPending}
      confirmLabel={t("lists.confirm")}
      cancelLabel={t("lists.cancel")}
      onCancel={onClose}
      onConfirm={() =>
        deleteList.mutate(list.id, {
          onSuccess: () => {
            onClose();
            onDeleted?.();
          },
        })
      }
    />
  );
}

// ── Shared bits ──────────────────────────────────────────

function CenteredSpinner() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
      <CircularProgress color="primary" />
    </Box>
  );
}

/** Error state for a list query that failed, with a retry. */
function ListErrorState({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <FancyEmpty
      icon={AlertTriangle}
      motif="orbit"
      title={t("lists.errorTitle")}
      body={t("lists.errorBody")}
      primary={
        <Button
          variant="outlined"
          size="small"
          startIcon={<RotateCcw size={14} />}
          onClick={onRetry}
        >
          {t("common.retry")}
        </Button>
      }
    />
  );
}

// ── Main Page ────────────────────────────────────────────

export function MyLists() {
  const { t } = useTranslation();
  useDocumentTitle(t("lists.title"));
  const [tab, setTab] = useState<"queue" | "lists">("queue");
  const [selectedList, setSelectedList] = useState<CustomListOutput | null>(null);

  const { data: watchlist } = useWatchlist();
  const { data: lists } = useCustomLists();
  const queueCount = watchlist?.length ?? 0;
  const listCount = lists?.length ?? 0;

  // Drilling into a custom list turns the page head into a breadcrumb
  // (Minhas Listas › {name}) and hides the subtitle/tabs, so the detail
  // view reads as one screen instead of stacking two headers.
  const inDetail = tab === "lists" && selectedList != null;

  return (
    <Box sx={{ px: { xs: 3, md: 5 }, pt: { xs: 4, md: 6 }, pb: 12, width: "100%" }}>
      <Box sx={{ mb: inDetail ? 2 : { xs: 3, md: 4 } }}>
        {inDetail ? (
          <Typography
            variant="breadcrumb"
            color="text.secondary"
            sx={{ display: "flex", alignItems: "center", gap: 1 }}
          >
            <Box
              component="button"
              type="button"
              onClick={() => setSelectedList(null)}
              sx={{
                all: "unset",
                cursor: "pointer",
                transition: "color 120ms ease",
                "&:hover": { color: inkAlpha(0.85) },
              }}
            >
              {t("lists.title")}
            </Box>
            <ChevronRight size={14} aria-hidden />
            <Box component="span" sx={{ color: inkAlpha(0.7) }}>
              {selectedList.name}
            </Box>
          </Typography>
        ) : (
          <>
            <Typography variant="eyebrow" sx={{ color: "primary.main", display: "block" }}>
              {t("lists.eyebrow")}
            </Typography>
            <Typography
              variant="pageTitle"
              sx={{
                mt: 1.25,
                fontSize: { xs: "2.1rem", md: "3rem" },
                fontWeight: 700,
                letterSpacing: "-0.03em",
                lineHeight: 1.05,
              }}
            >
              {t("lists.title")}
            </Typography>
            <Typography variant="pageSubtitle" sx={{ mt: 2, color: inkAlpha(0.55) }}>
              {t("lists.subtitle")}
            </Typography>
            <Box sx={{ mt: { xs: 3, md: 4 } }}>
              <AdminTabs
                tabs={[
                  {
                    key: "queue",
                    active: tab === "queue",
                    onClick: () => setTab("queue"),
                    label: (
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.1 }}>
                        {t("lists.watchlist")}
                        <CountPill count={queueCount} active={tab === "queue"} />
                      </Box>
                    ),
                  },
                  {
                    key: "lists",
                    active: tab === "lists",
                    onClick: () => setTab("lists"),
                    label: (
                      <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1.1 }}>
                        {t("lists.customLists")}
                        <CountPill count={listCount} active={tab === "lists"} />
                      </Box>
                    ),
                  },
                ]}
              />
            </Box>
          </>
        )}
      </Box>

      {tab === "queue" ? (
        <WatchlistTab />
      ) : inDetail ? (
        <CustomListDetail list={selectedList} onBack={() => setSelectedList(null)} />
      ) : (
        <CustomListsTab onSelectList={setSelectedList} />
      )}
    </Box>
  );
}
