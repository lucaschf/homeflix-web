import type { ReactNode, Ref } from "react";
import { TextField } from "@mui/material";
import { sanitizePin } from "./pin";

interface PinInputProps {
  label: string;
  value: string;
  /** Receives the sanitized value: ASCII digits only, at most six. */
  onChange: (pin: string) => void;
  disabled?: boolean;
  error?: boolean;
  helperText?: ReactNode;
  autoFocus?: boolean;
  /** The underlying ``<input>``, so the caller can move focus back to it. */
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * Attributes that tell browsers and password managers to neither save nor
 * fill this field: 1Password, LastPass, Bitwarden and Dashlane's own opt-outs.
 */
const PASSWORD_MANAGER_IGNORE = {
  "data-1p-ignore": "true",
  "data-lpignore": "true",
  "data-bwignore": "true",
  "data-form-type": "other",
} as const;

/**
 * One masked field for a six-digit parental PIN.
 *
 * A single input rather than six boxes: a pasted PIN lands whole, the
 * label and helper text are announced once, and the numeric keypad opens
 * on touch devices. There is no ``maxLength``: the browser would cut a
 * pasted ``"12 34 56"`` before the sanitizer drops the spaces.
 *
 * The PIN is not a password to the browser. A ``type="password"`` field is
 * offered to the password manager, which saves the PIN (or, next to the
 * account password, replaces the saved login with it) and later suggests it
 * to whoever holds the device. So the field is plain text with autocomplete
 * off and the password managers' ignore attributes, and it is masked with
 * CSS (``-webkit-text-security``) so a child next to the screen does not
 * read it. The visible label stays its accessible name.
 */
export function PinInput({
  label,
  value,
  onChange,
  disabled,
  error,
  helperText,
  autoFocus,
  inputRef,
}: PinInputProps) {
  return (
    <TextField
      fullWidth
      type="text"
      label={label}
      value={value}
      onChange={(event) => onChange(sanitizePin(event.target.value))}
      disabled={disabled}
      error={error}
      helperText={helperText}
      autoFocus={autoFocus}
      autoComplete="off"
      inputRef={inputRef}
      margin="normal"
      slotProps={{
        htmlInput: {
          inputMode: "numeric",
          pattern: "[0-9]*",
          // A text field would otherwise be sent to the spell checker.
          spellCheck: false,
          ...PASSWORD_MANAGER_IGNORE,
        },
      }}
      sx={{ "& input": { WebkitTextSecurity: "disc" } }}
    />
  );
}
