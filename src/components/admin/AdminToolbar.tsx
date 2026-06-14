import { Box, InputAdornment, MenuItem, Select, TextField } from "@mui/material";
import { Check, Search } from "lucide-react";
import type { ReactNode } from "react";
import { peachAlpha, whiteAlpha } from "../../theme/tokens";

interface AdminToolbarProps {
  children: ReactNode;
}

/**
 * Horizontal strip used below ``AdminPageHeader`` to host filters,
 * search and overflow actions. Keeps everything aligned on the same
 * baseline + wraps gracefully on narrow viewports.
 */
export function AdminToolbar({ children }: AdminToolbarProps) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.25,
        flexWrap: "wrap",
        py: 1.5,
        px: 0,
      }}
    >
      {children}
    </Box>
  );
}

interface ToolbarSearchProps {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}

/**
 * Search input pre-styled for the admin toolbar — dark surface,
 * mono-aligned font size, search icon adornment. Distinct from
 * ``AdminInput`` because it doesn't carry a separate eyebrow label
 * (the icon is enough affordance).
 */
export function ToolbarSearch({
  value,
  onChange,
  placeholder = "Search…",
}: ToolbarSearchProps) {
  return (
    <TextField
      size="small"
      variant="outlined"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      InputProps={{
        startAdornment: (
          <InputAdornment position="start">
            <Search size={15} aria-hidden />
          </InputAdornment>
        ),
        sx: {
          fontSize: "0.8125rem",
          bgcolor: whiteAlpha(0.025),
          minWidth: 240,
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: whiteAlpha(0.08),
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: whiteAlpha(0.16),
          },
        },
      }}
    />
  );
}

interface FilterChipOption<V> {
  label: ReactNode;
  value: V;
}

interface FilterChipProps<V> {
  label: ReactNode;
  value: V;
  options: FilterChipOption<V>[];
  onChange: (next: V) => void;
}

/**
 * Inline dropdown filter — a compact ``Select`` styled like a chip
 * so toolbars stay scannable. When ``value`` matches the default
 * option the chip renders neutral; otherwise the active selection
 * carries a peach accent so the operator sees the filter is on.
 */
export function FilterChip<V extends string | number>({
  label,
  value,
  options,
  onChange,
}: FilterChipProps<V>) {
  const active = options.findIndex((o) => o.value === value) > 0;
  return (
    <Select<V>
      size="small"
      value={value}
      displayEmpty
      onChange={(e) => onChange(e.target.value as V)}
      renderValue={(v) => {
        const opt = options.find((o) => o.value === v);
        return (
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
            {active && <Check size={13} aria-hidden />}
            <Box component="span" sx={{ color: "text.secondary", fontSize: "0.75rem" }}>
              {label}:
            </Box>
            <Box component="span">{opt?.label ?? String(v)}</Box>
          </Box>
        );
      }}
      sx={{
        fontSize: "0.8125rem",
        bgcolor: active ? peachAlpha(0.1) : whiteAlpha(0.025),
        borderRadius: 999,
        ".MuiOutlinedInput-notchedOutline": {
          borderColor: active ? peachAlpha(0.3) : whiteAlpha(0.08),
        },
        ".MuiSelect-select": { py: 0.6, pr: "32px !important", pl: 1.5 },
      }}
    >
      {options.map((o) => (
        <MenuItem key={String(o.value)} value={o.value} sx={{ fontSize: "0.8125rem" }}>
          {o.label}
        </MenuItem>
      ))}
    </Select>
  );
}
