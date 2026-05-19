import { Box, IconButton, Tooltip, Typography, alpha, useTheme } from "@mui/material";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrentUser } from "../../api/auth";

interface AdminTopbarProps {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * Top strip of the admin shell. Hosts the sidebar collapse toggle
 * on the left and the operator chip on the right.
 *
 * Intentionally minimal in P0 — no global search (no backend
 * endpoint), no settings dropdown. Real surfaces land in later
 * phases once their backing data exists.
 */
export function AdminTopbar({ collapsed, onToggleCollapsed }: AdminTopbarProps) {
  const { t } = useTranslation();
  const { data: user } = useCurrentUser();

  return (
    <Box
      sx={{
        height: 86,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 2, md: 3 },
        borderBottom: "1px solid rgba(255,255,255,0.08)",
        bgcolor: "background.default",
      }}
    >
      <Tooltip title={t(collapsed ? "admin.topbar.expand" : "admin.topbar.collapse")}>
        <IconButton
          onClick={onToggleCollapsed}
          size="small"
          sx={{ color: "text.secondary" }}
          aria-label={t(collapsed ? "admin.topbar.expand" : "admin.topbar.collapse")}
        >
          {collapsed ? <PanelLeft size={22} /> : <PanelLeftClose size={22} />}
        </IconButton>
      </Tooltip>

      {user && <UserChip email={user.email} role={user.role} />}
    </Box>
  );
}

function UserChip({ email, role }: { email: string; role: string }) {
  const theme = useTheme();
  const initials = email.slice(0, 2).toUpperCase();
  const isAdmin = role === "admin";

  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: `radial-gradient(circle at 35% 30%, ${alpha(theme.palette.primary.main, 0.95)}, ${theme.palette.primary.dark})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "rgba(255,255,255,0.85)",
          fontFamily: "serif",
          fontSize: "0.75rem",
        }}
      >
        {initials}
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", lineHeight: 1.2 }}>
        <Typography
          variant="body2"
          sx={{
            fontSize: "0.78125rem",
            color: "text.primary",
            fontWeight: 500,
            maxWidth: 200,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {email}
        </Typography>
        <Typography
          variant="eyebrow"
          sx={{
            fontSize: "0.5625rem",
            color: isAdmin ? "primary.main" : "text.secondary",
            letterSpacing: "0.16em",
          }}
        >
          {role}
        </Typography>
      </Box>
    </Box>
  );
}
