import { Box, ButtonBase } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { peach } from "../../theme/colors";
import { inkAlpha, whiteAlpha } from "../../theme/tokens";

export interface AdminTab {
  /** Stable identity for the tab. */
  key: string;
  label: ReactNode;
  active: boolean;
  /** Router target — renders the tab as a ``Link``. */
  to?: string;
  /** Click handler — renders the tab as a ``button`` (state-driven). */
  onClick?: () => void;
}

interface AdminTabsProps {
  tabs: AdminTab[];
}

/**
 * Underline tab bar shared across admin views. Each tab can be a router
 * ``Link`` (pass ``to``) or a state-driven ``button`` (pass ``onClick``)
 * so both navigation-based sections (intros) and local-state sections
 * (conflict queue) get the identical peach-underline treatment.
 */
export function AdminTabs({ tabs }: AdminTabsProps) {
  return (
    <Box
      role="tablist"
      sx={{
        display: "flex",
        gap: 0.5,
        borderBottom: `1px solid ${whiteAlpha(0.08)}`,
      }}
    >
      {tabs.map((tab) => {
        const sx = {
          px: 1.75,
          py: 1,
          fontSize: "0.8125rem",
          fontWeight: 500,
          fontFamily: "inherit",
          color: tab.active ? peach.main : inkAlpha(0.65),
          textDecoration: "none",
          background: "none",
          border: 0,
          borderBottom: "2px solid",
          borderColor: tab.active ? peach.main : "transparent",
          marginBottom: "-1px",
          cursor: "pointer",
          transition: "color 120ms ease, border-color 120ms ease",
          "&:hover": { color: tab.active ? peach.main : "text.primary" },
        };

        if (tab.to) {
          return (
            <Box key={tab.key} component={Link} to={tab.to} role="tab" aria-selected={tab.active} sx={sx}>
              {tab.label}
            </Box>
          );
        }

        return (
          <ButtonBase
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.active}
            onClick={tab.onClick}
            sx={sx}
          >
            {tab.label}
          </ButtonBase>
        );
      })}
    </Box>
  );
}
