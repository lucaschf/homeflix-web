import { type MouseEvent, useState } from "react";
import {
  Badge,
  Box,
  Divider,
  IconButton,
  List,
  ListItemButton,
  Menu,
  Stack,
  Typography,
} from "@mui/material";
import { Bell, Inbox } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useMarkNotificationRead, useNotifications } from "../api/hooks";
import type { Notification, NotificationKind } from "../api/types";
import { formatRelativeTime } from "../utils/schedule";

const DROPDOWN_WIDTH = 380;
/** Cap on rows shown in the popover. The full inbox query already
 *  pulls the latest 50; trimming further here keeps the dropdown
 *  scrolled to about a screenful so the user always sees the most
 *  recent first without an internal scrollbar competing with the
 *  page scroll. */
const DROPDOWN_MAX_ROWS = 8;

/**
 * Resolve the deep-link target for a notification row.
 *
 * Today the only producing kind is ``catalog_request_fulfilled``,
 * whose payload carries ``media_id`` + ``media_type`` so the row
 * routes the user straight to the newly available title. Unknown
 * shapes degrade to ``null`` — the row stays a plain "mark read"
 * click without navigation.
 */
function resolveDeepLink(notification: Notification): string | null {
  const mediaId = notification.payload.media_id;
  const mediaType = notification.payload.media_type;
  if (typeof mediaId !== "string" || typeof mediaType !== "string") {
    return null;
  }
  if (mediaType === "movie") return `/movies/${mediaId}`;
  if (mediaType === "series") return `/series/${mediaId}`;
  return null;
}

/**
 * Localised body text used when the backend leaves ``body`` null.
 *
 * Keyed by ``NotificationKind`` so adding a new kind on the
 * server is a one-line addition here plus the matching i18n key.
 * Falls back to the empty string for unknown kinds, which renders
 * the row as title-only — better than a blank "undefined" line.
 */
function bodyFallbackKey(kind: NotificationKind): string {
  switch (kind) {
    case "catalog_request_fulfilled":
      return "notifications.kind.catalog_request_fulfilled.body";
    default:
      return "";
  }
}

/**
 * Header bell with unread badge and a dropdown showing the latest
 * notifications. Clicking a row marks it read and (when the
 * payload carries a deep-link target) navigates to the title.
 */
export function NotificationBell() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;
  const visible = items.slice(0, DROPDOWN_MAX_ROWS);

  const handleOpen = (event: MouseEvent<HTMLElement>) => setAnchor(event.currentTarget);
  const handleClose = () => setAnchor(null);

  const handleRowClick = (notification: Notification) => {
    if (!notification.is_read) {
      // Fire-and-forget — the inbox cache invalidation in
      // ``useMarkNotificationRead`` will reconcile the row state.
      // If the mutation fails, the user can always click again
      // (the backend is idempotent).
      markRead.mutate(notification.id);
    }
    const deepLink = resolveDeepLink(notification);
    handleClose();
    if (deepLink) navigate(deepLink);
  };

  return (
    <>
      <IconButton
        onClick={handleOpen}
        size="small"
        aria-label={t("nav.notifications")}
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        sx={{
          color: "text.secondary",
          "&:hover": { color: "text.primary" },
        }}
      >
        <Badge
          badgeContent={unreadCount}
          color="primary"
          overlap="circular"
          max={99}
          sx={{
            "& .MuiBadge-badge": {
              minWidth: 16,
              height: 16,
              fontSize: 10,
              fontWeight: 600,
              padding: "0 4px",
            },
          }}
        >
          <Bell size={22} />
        </Badge>
      </IconButton>

      <Menu
        anchorEl={anchor}
        open={anchor !== null}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        slotProps={{
          paper: {
            sx: {
              mt: 1,
              width: DROPDOWN_WIDTH,
              maxWidth: "calc(100vw - 32px)",
              bgcolor: "background.paper",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              overflow: "hidden",
            },
          },
        }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography
              variant="caption"
              sx={{
                color: "text.secondary",
                fontSize: 11,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}
            >
              {t("notifications.title")}
            </Typography>
            {unreadCount > 0 && (
              <Typography
                variant="caption"
                sx={{
                  color: "primary.light",
                  fontSize: 11,
                  fontWeight: 600,
                }}
              >
                {t("notifications.unreadCount", { count: unreadCount })}
              </Typography>
            )}
          </Stack>
        </Box>
        <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.08)" }} />

        {isLoading ? (
          <Box sx={{ px: 2, py: 3, textAlign: "center" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {t("notifications.loading")}
            </Typography>
          </Box>
        ) : visible.length === 0 ? (
          <Box
            sx={{
              px: 2,
              py: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 1,
            }}
          >
            <Inbox
              size={28}
              color="rgba(245, 241, 235, 0.4)"
              aria-hidden
            />
            <Typography
              variant="body2"
              sx={{ color: "text.secondary", textAlign: "center" }}
            >
              {t("notifications.empty")}
            </Typography>
          </Box>
        ) : (
          <List sx={{ py: 0, maxHeight: 460, overflowY: "auto" }}>
            {visible.map((notification) => {
              const fallbackKey = bodyFallbackKey(notification.kind);
              const body =
                notification.body ?? (fallbackKey ? t(fallbackKey) : "");
              const ago = formatRelativeTime(
                notification.created_at,
                i18n.language,
                t,
              );
              return (
                <ListItemButton
                  key={notification.id}
                  onClick={() => handleRowClick(notification)}
                  sx={{
                    px: 2,
                    py: 1.25,
                    alignItems: "flex-start",
                    gap: 1.25,
                    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
                    "&:last-of-type": { borderBottom: 0 },
                    "&:hover": {
                      bgcolor: "rgba(255, 255, 255, 0.04)",
                    },
                  }}
                >
                  {/* Unread indicator dot — reserved gutter even
                      when read so titles stay aligned across rows. */}
                  <Box
                    aria-hidden
                    sx={{
                      mt: 0.6,
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: notification.is_read
                        ? "transparent"
                        : "primary.main",
                      flexShrink: 0,
                    }}
                  />
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography
                      sx={{
                        fontSize: 13,
                        fontWeight: notification.is_read ? 500 : 600,
                        color: "text.primary",
                        lineHeight: 1.3,
                      }}
                      noWrap
                    >
                      {notification.title}
                    </Typography>
                    {body && (
                      <Typography
                        sx={{
                          fontSize: 12,
                          color: "text.secondary",
                          mt: 0.25,
                          lineHeight: 1.4,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                        }}
                      >
                        {body}
                      </Typography>
                    )}
                    <Typography
                      sx={{
                        fontSize: 11,
                        color: "text.disabled",
                        mt: 0.5,
                        letterSpacing: "0.02em",
                      }}
                    >
                      {ago}
                    </Typography>
                  </Box>
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Menu>
    </>
  );
}
