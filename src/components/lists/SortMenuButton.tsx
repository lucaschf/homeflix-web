import { useState } from "react";
import { Box, Button, Menu, MenuItem } from "@mui/material";
import { ChevronDown } from "lucide-react";
import { fontFamily, fontSize } from "../../theme/tokens";

export interface SortOption<T extends string> {
  key: T;
  label: string;
}

interface SortMenuButtonProps<T extends string> {
  /** Eyebrow label rendered in caps, e.g. "ORDENAR". */
  label: string;
  /** Currently selected option key. */
  value: T;
  options: SortOption<T>[];
  onChange: (value: T) => void;
}

/**
 * Sort dropdown shared by the queue toolbar and the list view. Built on the
 * canonical ``hairline`` Button variant (ADR-001) so it shares its toolbar
 * siblings' 8px radius and height — replacing the former hand-rolled
 * ``Box component="button"`` pill (14px radius) that was duplicated across the
 * two screens.
 */
export function SortMenuButton<T extends string>({
  label,
  value,
  options,
  onChange,
}: SortMenuButtonProps<T>) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const current = options.find((o) => o.key === value);

  return (
    <>
      <Button
        variant="hairline"
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{ gap: 1, color: "text.secondary" }}
      >
        <Box
          component="span"
          sx={{
            fontFamily: fontFamily.mono,
            fontSize: fontSize.micro,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            opacity: 0.7,
          }}
        >
          {label}
        </Box>
        <Box
          component="span"
          sx={{ color: "text.primary", fontSize: fontSize.control, whiteSpace: "nowrap" }}
        >
          {current?.label}
        </Box>
        <ChevronDown size={13} />
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {options.map((o) => (
          <MenuItem
            key={o.key}
            selected={o.key === value}
            onClick={() => {
              onChange(o.key);
              setAnchor(null);
            }}
          >
            {o.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
