import { useState } from "react";
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
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import { ArrowLeft, Bookmark, MoreVertical, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import {
  useCreateCustomList,
  useCustomListItems,
  useCustomLists,
  useDeleteCustomList,
  useRenameCustomList,
  useWatchlist,
} from "../api/hooks";
import type { CustomListOutput } from "../api/types";
import { MediaCard } from "../components/MediaCard";

const MAX_LISTS = 10;

// ── Watchlist Tab ────────────────────────────────────────

function WatchlistTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: items, isLoading } = useWatchlist();

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (!items?.length) {
    return (
      <Box sx={{ textAlign: "center", py: 10 }}>
        <Bookmark size={48} color="#555" />
        <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
          {t("lists.empty")}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {t("lists.emptyHint")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(3, 1fr)",
          sm: "repeat(4, 1fr)",
          md: "repeat(5, 1fr)",
          lg: "repeat(6, 1fr)",
        },
        gap: { xs: 1, sm: 1.5, md: 2 },
      }}
    >
      {items.map((item) => (
        <MediaCard
          key={item.media_id}
          title={item.title}
          imageUrl={item.poster_path ?? undefined}
          variant="poster"
          fullWidth
          onClick={() => {
            if (item.media_type === "movie") navigate(`/movie/${item.media_id}`);
            else navigate(`/series/${item.media_id}`);
          }}
        />
      ))}
    </Box>
  );
}

// ── Custom Lists Tab ─────────────────────────────────────

function CustomListsTab() {
  const { t } = useTranslation();
  const { data: lists, isLoading } = useCustomLists();
  const [selectedList, setSelectedList] = useState<CustomListOutput | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (selectedList) {
    return (
      <CustomListDetail
        list={selectedList}
        onBack={() => setSelectedList(null)}
      />
    );
  }

  const count = lists?.length ?? 0;

  return (
    <>
      <Box sx={{ display: "flex", alignItems: "center", gap: 2, mb: 3 }}>
        <Button
          variant="outlined"
          color="primary"
          size="small"
          startIcon={<Plus size={16} />}
          disabled={count >= MAX_LISTS}
          onClick={() => setCreateOpen(true)}
          sx={{ textTransform: "uppercase", fontWeight: 600, fontSize: "0.75rem" }}
        >
          {t("lists.createList")}
        </Button>
        <Typography variant="body2" color="text.secondary">
          {t("lists.listCount", { count, max: MAX_LISTS })}
        </Typography>
      </Box>

      {count > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          {lists!.map((list) => (
            <CustomListCard
              key={list.id}
              list={list}
              onClick={() => setSelectedList(list)}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Bookmark size={48} color="#555" />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            {t("lists.customListsEmpty")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("lists.customListsEmptyHint")}
          </Typography>
        </Box>
      )}

      <CreateListDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}

// ── Custom List Card ─────────────────────────────────────

function CustomListCard({ list, onClick }: { list: CustomListOutput; onClick: () => void }) {
  const { t } = useTranslation();
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const formattedDate = new Date(list.updated_at).toLocaleDateString();

  return (
    <>
      <Box
        onClick={onClick}
        sx={{
          bgcolor: "background.paper",
          borderRadius: 1.5,
          p: 2.5,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          transition: "background-color 200ms",
          "&:hover": { bgcolor: "#1E1E1E" },
        }}
      >
        <Box>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {list.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("lists.itemCount", { count: list.item_count })} &bull;{" "}
            {t("lists.updatedAt", { date: formattedDate })}
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setMenuAnchor(e.currentTarget);
          }}
        >
          <MoreVertical size={18} />
        </IconButton>
      </Box>

      <Menu
        anchorEl={menuAnchor}
        open={!!menuAnchor}
        onClose={() => setMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setRenameOpen(true);
          }}
        >
          {t("lists.rename")}
        </MenuItem>
        <MenuItem
          onClick={() => {
            setMenuAnchor(null);
            setDeleteOpen(true);
          }}
          sx={{ color: "error.main" }}
        >
          {t("lists.delete")}
        </MenuItem>
      </Menu>

      <RenameListDialog
        list={list}
        open={renameOpen}
        onClose={() => setRenameOpen(false)}
      />
      <DeleteListDialog
        list={list}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
      />
    </>
  );
}

// ── Custom List Detail ───────────────────────────────────

function CustomListDetail({ list, onBack }: { list: CustomListOutput; onBack: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: items, isLoading } = useCustomListItems(list.id);

  return (
    <Box>
      <Button
        size="small"
        startIcon={<ArrowLeft size={16} />}
        onClick={onBack}
        sx={{ mb: 2, textTransform: "uppercase", fontSize: "0.75rem", color: "text.secondary" }}
      >
        {t("lists.backToLists")}
      </Button>

      <Typography variant="h2" sx={{ mb: 1, fontWeight: 700 }}>
        {list.name}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        {t("lists.itemCount", { count: list.item_count })}
      </Typography>

      {isLoading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 10 }}>
          <CircularProgress color="primary" />
        </Box>
      ) : items?.length ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(3, 1fr)",
              sm: "repeat(4, 1fr)",
              md: "repeat(5, 1fr)",
              lg: "repeat(6, 1fr)",
            },
            gap: { xs: 1, sm: 1.5, md: 2 },
          }}
        >
          {items.map((item) => (
            <MediaCard
              key={item.media_id}
              title={item.title}
              imageUrl={item.poster_path ?? undefined}
              variant="poster"
              fullWidth
              onClick={() => {
                if (item.media_type === "movie") navigate(`/movie/${item.media_id}`);
                else navigate(`/series/${item.media_id}`);
              }}
            />
          ))}
        </Box>
      ) : (
        <Box sx={{ textAlign: "center", py: 10 }}>
          <Bookmark size={48} color="#555" />
          <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
            {t("lists.listItemsEmpty")}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {t("lists.listItemsEmptyHint")}
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// ── Dialogs ──────────────────────────────────────────────

function CreateListDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const createList = useCreateCustomList();

  const handleCreate = () => {
    if (!name.trim()) return;
    createList.mutate(name.trim(), {
      onSuccess: () => {
        setName("");
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("lists.createList")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          variant="standard"
          label={t("lists.listName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="outlined">
          {t("lists.cancel")}
        </Button>
        <Button
          onClick={handleCreate}
          color="primary"
          variant="contained"
          disabled={!name.trim() || createList.isPending}
        >
          {t("lists.create")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

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
  const [name, setName] = useState(list.name);
  const renameList = useRenameCustomList();

  const handleRename = () => {
    if (!name.trim() || name.trim() === list.name) return;
    renameList.mutate(
      { listId: list.id, name: name.trim() },
      { onSuccess: onClose },
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("lists.renameList")}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          variant="standard"
          label={t("lists.listName")}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleRename()}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="outlined">
          {t("lists.cancel")}
        </Button>
        <Button
          onClick={handleRename}
          color="primary"
          variant="contained"
          disabled={!name.trim() || name.trim() === list.name || renameList.isPending}
        >
          {t("lists.rename")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function DeleteListDialog({
  list,
  open,
  onClose,
}: {
  list: CustomListOutput;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const deleteList = useDeleteCustomList();

  const handleDelete = () => {
    deleteList.mutate(list.id, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{t("lists.delete")}</DialogTitle>
      <DialogContent>
        <Typography>{t("lists.deleteConfirm")}</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="primary" variant="outlined">
          {t("lists.cancel")}
        </Button>
        <Button
          onClick={handleDelete}
          color="error"
          variant="contained"
          disabled={deleteList.isPending}
        >
          {t("lists.confirm")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ────────────────────────────────────────────

export function MyLists() {
  const { t } = useTranslation();
  const [tab, setTab] = useState(0);

  return (
    <Box sx={{ px: { xs: 2, md: 6 }, py: { xs: 3, md: 5 }, maxWidth: 1200, mx: "auto" }}>
      <Typography
        variant="h1"
        sx={{
          fontSize: { xs: "1.5rem", md: "1.75rem" },
          fontWeight: 700,
          mb: 2,
          textAlign: "center",
        }}
      >
        {t("lists.title")}
      </Typography>

      <Box sx={{ display: "flex", justifyContent: "center", mb: 4 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{
            "& .MuiTab-root": {
              textTransform: "uppercase",
              fontWeight: 600,
              fontSize: "0.8rem",
              letterSpacing: "0.05em",
              minWidth: 120,
            },
          }}
        >
          <Tab label={t("lists.watchlist")} />
          <Tab label={t("lists.customLists")} />
        </Tabs>
      </Box>

      {tab === 0 && <WatchlistTab />}
      {tab === 1 && <CustomListsTab />}
    </Box>
  );
}
