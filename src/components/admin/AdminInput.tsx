import { Box, TextField, type TextFieldProps, Typography } from "@mui/material";
import { whiteAlpha } from "../../theme/tokens";

type AdminInputProps = Omit<TextFieldProps, "label" | "variant"> & {
  label?: string;
  mono?: boolean;
};

/**
 * Dark-surface text field with a mono-uppercase eyebrow label
 * stacked above. Used inside ``AdminFormSection`` and ad-hoc
 * filters.
 *
 * The MUI ``TextField`` default label sits inside the input
 * affordance (the "floating label" pattern). The admin design
 * pulls the label *out* and uses the eyebrow type, so we render
 * the label ourselves and pass ``label={undefined}`` through to
 * MUI to avoid duplication.
 */
export function AdminInput({
  label,
  mono = false,
  sx,
  InputProps,
  ...rest
}: AdminInputProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.875 }}>
      {label && (
        <Typography
          variant="eyebrow"
          component="label"
          sx={{
            color: "text.secondary",
            letterSpacing: "0.14em",
            fontSize: "0.625rem",
          }}
        >
          {label}
        </Typography>
      )}
      <TextField
        {...rest}
        variant="outlined"
        size="small"
        InputProps={{
          ...InputProps,
          sx: {
            fontSize: "0.875rem",
            fontFamily: mono ? "'JetBrains Mono', ui-monospace, monospace" : undefined,
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
            ...(InputProps?.sx ?? {}),
          },
        }}
        sx={sx}
      />
    </Box>
  );
}
