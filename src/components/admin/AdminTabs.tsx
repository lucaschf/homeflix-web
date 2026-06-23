import { Tab, Tabs } from "@mui/material";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { peach } from "../../theme/colors";
import { fontSize, inkAlpha, whiteAlpha } from "../../theme/tokens";

export interface AdminTab {
  /** Stable identity for the tab; also the selected ``value``. */
  key: string;
  label: ReactNode;
  active: boolean;
  /** Router target — renders the tab as a ``Link``. */
  to?: string;
  /** Click handler — renders the tab as a state-driven button. */
  onClick?: () => void;
}

interface AdminTabsProps {
  tabs: AdminTab[];
}

const tabSx = {
  minHeight: 0,
  minWidth: "auto",
  px: 1.75,
  py: 1,
  fontFamily: "inherit",
  fontSize: fontSize.control,
  fontWeight: 500,
  textTransform: "none",
  color: inkAlpha(0.65),
  transition: "color 120ms ease",
  "&:hover": { color: "text.primary" },
  "&.Mui-selected": { color: peach.main },
} as const;

/**
 * Underline tab bar shared across admin views, built on MUI ``Tabs`` so the
 * sliding peach indicator and arrow-key navigation come for free. Each tab can
 * be a router ``Link`` (pass ``to``) or a state-driven button (pass
 * ``onClick``); selection is derived from each tab's ``active`` flag, so both
 * navigation-based sections (intros) and local-state sections (conflict queue)
 * stay controlled by the caller.
 */
export function AdminTabs({ tabs }: AdminTabsProps) {
  const activeKey = tabs.find((tab) => tab.active)?.key ?? false;

  return (
    <Tabs
      value={activeKey}
      sx={{
        minHeight: 0,
        borderBottom: `1px solid ${whiteAlpha(0.08)}`,
        "& .MuiTabs-flexContainer": { gap: 0.5 },
        "& .MuiTabs-indicator": { height: 2, backgroundColor: peach.main },
      }}
    >
      {tabs.map((tab) =>
        tab.to ? (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            component={Link}
            to={tab.to}
            sx={tabSx}
          />
        ) : (
          <Tab
            key={tab.key}
            value={tab.key}
            label={tab.label}
            onClick={tab.onClick}
            sx={tabSx}
          />
        ),
      )}
    </Tabs>
  );
}
