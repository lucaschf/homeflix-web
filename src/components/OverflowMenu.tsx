import { useState, type ReactNode } from "react";
import { Box, IconButton, Menu, MenuItem, Tooltip } from "@mui/material";
import { MoreHorizontal } from "lucide-react";
import { ACTION_BAR_HEIGHT, fontSize, status, whiteAlpha } from "../theme/tokens";
import { neutral } from "../theme/colors";

export interface OverflowAction {
  key: string;
  icon: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Tint the item with the "set" accent (e.g. flagged / has credits). */
  active?: boolean;
}

/**
 * A "⋯" button that folds a set of secondary actions into a menu so an
 * action bar keeps only its primary controls inline. Used for the
 * admin-only actions on the detail pages (flag enrichment, edit
 * credits, run subtitle OCR) that previously sat as loose icon buttons
 * and wrapped to a second row on mobile.
 */
export function OverflowMenu({
  actions,
  ariaLabel,
}: {
  actions: OverflowAction[];
  ariaLabel: string;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  if (actions.length === 0) return null;

  return (
    <>
      <Tooltip title={ariaLabel} arrow>
        <IconButton
          aria-label={ariaLabel}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            color: "text.primary",
            bgcolor: whiteAlpha(0.08),
            border: `1px solid ${whiteAlpha(0.12)}`,
            borderRadius: 1,
            width: ACTION_BAR_HEIGHT,
            height: ACTION_BAR_HEIGHT,
            "&:hover": { bgcolor: whiteAlpha(0.12), borderColor: whiteAlpha(0.2) },
          }}
        >
          <MoreHorizontal size={18} />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              bgcolor: neutral[900],
              border: `1px solid ${whiteAlpha(0.1)}`,
              minWidth: 208,
            },
          },
        }}
      >
        {actions.map((action) => (
          <MenuItem
            key={action.key}
            disabled={action.disabled}
            onClick={() => {
              setAnchorEl(null);
              action.onClick();
            }}
            sx={{
              gap: 1.25,
              fontSize: fontSize.control,
              color: action.active ? status.warn.fg : "text.primary",
              "& svg": { color: action.active ? status.warn.fg : "text.secondary" },
            }}
          >
            <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
              {action.icon}
            </Box>
            {action.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
