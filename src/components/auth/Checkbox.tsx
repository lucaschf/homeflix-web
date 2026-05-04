import { useId, type ChangeEvent } from "react";
import { Box } from "@mui/material";

interface CheckboxProps {
  checked: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  label: string;
  disabled?: boolean;
}

/**
 * 16×16 peach-fill checkbox per Variação B. The native ``<input>``
 * is hidden but kept in the DOM for keyboard / form / a11y
 * behaviour; the visible ``<span>`` mirrors its checked state.
 */
export function Checkbox({ checked, onChange, label, disabled = false }: CheckboxProps) {
  const id = useId();
  return (
    <Box
      component="label"
      htmlFor={id}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.25,
        cursor: disabled ? "not-allowed" : "pointer",
        userSelect: "none",
        fontSize: 13,
        color: "rgba(245, 241, 235, 0.78)",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 16,
          height: 16,
          borderRadius: "3px",
          border: `1px solid ${checked ? "rgba(217, 119, 87, 1)" : "rgba(255, 255, 255, 0.25)"}`,
          bgcolor: checked ? "primary.main" : "transparent",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 150ms ease",
          flexShrink: 0,
        }}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5 L4.2 7 L8 3"
              stroke="#0D0D0D"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </Box>
      <Box
        component="input"
        id={id}
        type="checkbox"
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        sx={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
      />
      {label}
    </Box>
  );
}
