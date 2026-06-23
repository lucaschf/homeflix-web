import {
  Box,
  MenuItem,
  Select,
  type SelectProps,
  Typography,
} from "@mui/material";
import type { ReactNode } from "react";
import { fontFamily, whiteAlpha } from "../../theme/tokens";

interface AdminSelectOption<V> {
  value: V;
  label: ReactNode;
  /** Secondary inline label (e.g. ISO code) shown muted next to the
   *  primary label inside the dropdown menu. */
  meta?: ReactNode;
}

type AdminSelectProps<V> = Omit<SelectProps<V>, "variant" | "label" | "size"> & {
  /** Eyebrow label rendered above the select (matches AdminInput). */
  label?: string;
  options: AdminSelectOption<V>[];
  mono?: boolean;
  fullWidth?: boolean;
};

/**
 * Dark-surface dropdown with the mono-uppercase eyebrow label stacked
 * above — companion to ``AdminInput`` so the two affordances render
 * identically inside ``AdminFormSection`` rows.
 *
 * Why this exists: MUI's ``Select`` doesn't expose a slot for an
 * out-of-input label, and every admin form was reaching into the
 * eyebrow Typography + ``sx`` block by hand. Centralizing the
 * label + dark-surface tokens here lets future spacing / typography
 * tweaks land in one place.
 */
export function AdminSelect<V extends string | number>({
  label,
  options,
  mono = false,
  fullWidth = false,
  sx,
  ...rest
}: AdminSelectProps<V>) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.875,
        minWidth: 0,
        width: fullWidth ? "100%" : undefined,
      }}
    >
      {label && (
        <Typography
          variant="eyebrow"
          component="label"
          sx={{ color: "text.secondary" }}
        >
          {label}
        </Typography>
      )}
      <Select<V>
        {...rest}
        size="small"
        sx={[
          {
            fontSize: "0.875rem",
            fontFamily: mono ? fontFamily.mono : undefined,
            bgcolor: whiteAlpha(0.025),
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: whiteAlpha(0.08),
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: whiteAlpha(0.16),
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: "primary.main",
            },
          },
          ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
        ]}
      >
        {options.map((opt) => (
          <MenuItem
            key={String(opt.value)}
            value={opt.value}
            sx={{ fontSize: "0.875rem" }}
          >
            <Box sx={{ display: "flex", alignItems: "baseline", gap: 1, minWidth: 0 }}>
              <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
                {opt.label}
              </Box>
              {opt.meta && (
                <Box
                  component="span"
                  sx={{
                    color: "text.secondary",
                    fontFamily: fontFamily.mono,
                    fontSize: "0.75rem",
                    flexShrink: 0,
                  }}
                >
                  {opt.meta}
                </Box>
              )}
            </Box>
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
