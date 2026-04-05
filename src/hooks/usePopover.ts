import { useCallback, useRef, useState } from "react";

export function usePopover() {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const handleOpen = useCallback(() => setOpen(true), []);
  const handleClose = useCallback(() => setOpen(false), []);
  const handleToggle = useCallback(() => setOpen((prev) => !prev), []);

  return { anchorRef, open, handleOpen, handleClose, handleToggle };
}
