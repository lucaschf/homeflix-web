/** Digits in a parental PIN (ADR-035, Amendment 7 D4). */
export const PIN_LENGTH = 6;

// ``[0-9]`` rather than ``\d`` or a Unicode class: the backend accepts ASCII
// digits only, so other scripts' digits never count toward a complete PIN.
const COMPLETE_PIN = new RegExp(`^[0-9]{${PIN_LENGTH}}$`);

/**
 * Keeps the ASCII digits of whatever was typed or pasted, up to
 * ``PIN_LENGTH``. A pasted ``"12 34 56"`` becomes ``"123456"``.
 */
export function sanitizePin(raw: string): string {
  return raw.replace(/[^0-9]/g, "").slice(0, PIN_LENGTH);
}

/** Whether ``pin`` is exactly ``PIN_LENGTH`` ASCII digits. */
export function isCompletePin(pin: string): boolean {
  return COMPLETE_PIN.test(pin);
}

/** A lockout wait as ``m:ss`` (or ``h:mm:ss`` from one hour up). */
export function formatWait(totalSeconds: number): string {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(seconds % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
