import { useState } from "react";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  TextField,
  Typography,
} from "@mui/material";
import { Check, Plus, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useAddItemToCustomList,
  useCreateCustomList,
  useCustomLists,
} from "../api/hooks";

interface AddToListDialogProps {
  open: boolean;
  onClose: () => void;
  mediaId: string;
  mediaType: "movie" | "series";
}

export function AddToListDialog({ open, onClose, mediaId, mediaType }: AddToListDialogProps) {
  const { t } = useTranslation();
  const { data: lists, isLoading } = useCustomLists();
  const addItem = useAddItemToCustomList();
  const createList = useCreateCustomList();
  const [addedTo, setAddedTo] = useState<Set<string>>(new Set());
  const [showCreate, setShowCreate] = useState(false);
  const [newListName, setNewListName] = useState("");

  const handleAdd = (listId: string) => {
    addItem.mutate(
      { listId, media_id: mediaId, media_type: mediaType },
      {
        onSuccess: () => {
          setAddedTo((prev) => new Set(prev).add(listId));
        },
      },
    );
  };

  const handleCreate = () => {
    if (!newListName.trim()) return;
    createList.mutate(newListName.trim(), {
      onSuccess: (resp) => {
        setNewListName("");
        setShowCreate(false);
        // Auto-add media to the newly created list
        const newList = resp.data;
        addItem.mutate(
          { listId: newList.id, media_id: mediaId, media_type: mediaType },
          {
            onSuccess: () => {
              setAddedTo((prev) => new Set(prev).add(newList.id));
            },
          },
        );
      },
    });
  };

  const handleClose = () => {
    setAddedTo(new Set());
    setShowCreate(false);
    setNewListName("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        {t("lists.addToListTitle")}
        <IconButton size="small" onClick={handleClose}>
          <X size={18} />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 0, pb: 2 }}>
        {isLoading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : (
          <>
            <List disablePadding>
              {lists?.map((list) => {
                const wasAdded = addedTo.has(list.id);
                return (
                  <ListItemButton
                    key={list.id}
                    onClick={() => !wasAdded && handleAdd(list.id)}
                    disabled={wasAdded}
                    sx={{ px: 3 }}
                  >
                    <ListItemText
                      primary={list.name}
                      secondary={t("lists.itemCount", { count: list.item_count })}
                    />
                    {wasAdded && <Check size={18} color="#4ADE80" />}
                  </ListItemButton>
                );
              })}
            </List>

            {!lists?.length && (
              <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 2 }}>
                {t("lists.noLists")}
              </Typography>
            )}

            {showCreate ? (
              <Box sx={{ px: 3, pt: 2, display: "flex", gap: 1, alignItems: "flex-end" }}>
                <TextField
                  autoFocus
                  fullWidth
                  variant="standard"
                  label={t("lists.listName")}
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  size="small"
                />
                <Button
                  size="small"
                  variant="contained"
                  onClick={handleCreate}
                  disabled={!newListName.trim() || createList.isPending}
                  sx={{ minWidth: "auto", px: 2, whiteSpace: "nowrap" }}
                >
                  {t("lists.create")}
                </Button>
              </Box>
            ) : (
              <Box sx={{ px: 3, pt: 1 }}>
                <Button
                  size="small"
                  startIcon={<Plus size={16} />}
                  onClick={() => setShowCreate(true)}
                  sx={{ textTransform: "none", color: "primary.main" }}
                >
                  {t("lists.createAndAdd")}
                </Button>
              </Box>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
