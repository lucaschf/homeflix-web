import { useCallback, useState } from "react";

/**
 * Manages an anchor-based popover (MUI Menu / Popover / Popper).
 *
 * Uses a callback ref + state for the anchor element instead of a
 * `useRef` so consumers can read `anchorEl` in JSX without tripping
 * the React 19 `react-hooks/refs` rule ("Cannot access refs during
 * render"). State is observable and triggers a re-render when the
 * Button mounts, which is exactly what the MUI `anchorEl` prop needs.
 */
export function usePopover() {
  const [anchorEl, setAnchorEl] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);

  // Callback ref — passed as `ref={anchorRef}` on the trigger element.
  // React calls it once with the DOM node on mount and once with null
  // on unmount, keeping `anchorEl` state in sync automatically.
  const anchorRef = useCallback((node: HTMLButtonElement | null) => {
    setAnchorEl(node);
  }, []);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleToggle = useCallback(() => setOpen((prev) => !prev), []);

  return { anchorRef, anchorEl, open, handleOpen, handleClose, handleToggle };
}
