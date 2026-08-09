import { useEffect, useState } from "react";
import { Box, CircularProgress, Dialog, InputBase, Typography } from "@mui/material";
import { Copy, Share2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRevokeShareList, useShareList } from "../../api/hooks";
import { AdminButton } from "../admin/AdminButton";
import { useToast } from "../ToastProvider";
import { peach } from "../../theme/colors";
import { peachAlpha, whiteAlpha } from "../../theme/tokens";

/**
 * "Share this list" dialog. On open it ensures a share token exists
 * (the backend's share endpoint is idempotent) and shows the resulting
 * link plus a copy button; "Stop sharing" revokes the token.
 *
 * Gated by `SHARE_ENABLED` at the call site — this component assumes the
 * backend serves the share endpoints and never mounts while the flag is
 * off, so it doesn't gate internally.
 */
export function ShareListDialog({
  listId,
  open,
  onClose,
  onRevoked,
}: {
  listId: string;
  open: boolean;
  onClose: () => void;
  /** Fired after sharing is revoked (e.g. to refresh the shared badge). */
  onRevoked?: () => void;
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  // `mutate` is referentially stable in react-query, so using it as an
  // effect dep doesn't re-run the effect on every render.
  const { mutate: mintShare, isPending: minting } = useShareList();
  const { mutate: revoke, isPending: revoking } = useRevokeShareList();
  const [link, setLink] = useState<string | null>(null);

  // Ensure a token exists when the dialog opens (share is idempotent).
  // The dialog is mounted fresh each time it opens (the parent renders it
  // conditionally), so there's no stale link to clear — `link` starts
  // null on every mount and is set once the token resolves.
  useEffect(() => {
    if (!open) return;
    mintShare(listId, {
      onSuccess: (resp) => {
        const path = resp.data.url_path || `/lists/shared/${resp.data.token}`;
        setLink(`${window.location.origin}${path}`);
      },
    });
  }, [open, listId, mintShare]);

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      showToast(t("lists.share.copied"));
    } catch {
      // Clipboard blocked (permissions / insecure context) — the link is
      // visible and selectable in the field, so the user can copy manually.
    }
  };

  const handleRevoke = () => {
    revoke(listId, {
      onSuccess: () => {
        onRevoked?.();
        onClose();
      },
    });
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
            <Share2 size={18} color={peach.main} />
          </Box>
          <Box>
            <Typography sx={{ fontSize: "1.05rem", fontWeight: 600 }}>
              {t("lists.share.title")}
            </Typography>
            <Typography sx={{ fontSize: "0.72rem", color: "text.secondary" }}>
              {t("lists.share.helper")}
            </Typography>
          </Box>
        </Box>

        <Typography variant="eyebrow" sx={{ color: "text.secondary", display: "block", mb: 0.75 }}>
          {t("lists.share.linkLabel")}
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            border: `1px solid ${whiteAlpha(0.1)}`,
            borderRadius: 1,
            px: 1.25,
            py: 0.5,
            minHeight: 42,
          }}
        >
          {minting || !link ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "text.secondary" }}>
              <CircularProgress size={16} color="inherit" />
            </Box>
          ) : (
            <>
              <InputBase
                value={link}
                readOnly
                fullWidth
                onFocus={(e) => e.target.select()}
                sx={{ fontSize: "0.8rem", color: "text.primary" }}
              />
              <AdminButton
                variant="secondary"
                icon={<Copy size={14} />}
                onClick={copy}
                sx={{ flexShrink: 0, minWidth: 0, px: 1.25 }}
              >
                {t("lists.share.copy")}
              </AdminButton>
            </>
          )}
        </Box>

        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mt: 3 }}>
          <AdminButton
            variant="ghost"
            onClick={handleRevoke}
            disabled={revoking || !link}
            sx={{ color: "error.main" }}
          >
            {t("lists.share.stop")}
          </AdminButton>
          <AdminButton variant="primary" onClick={onClose}>
            {t("lists.cancel")}
          </AdminButton>
        </Box>
      </Box>
    </Dialog>
  );
}
