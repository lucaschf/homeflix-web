import { Dialog, type DialogProps } from "@mui/material";

/**
 * Shared MUI ``Dialog`` wrapper that pins the admin modal chrome —
 * solid ``#0d0d0d`` background (no MUI elevation overlay), a hairline
 * border on the surface, and the slightly tighter ``1.5`` border
 * radius the design uses for confirm/picker modals.
 *
 * Every admin dialog (``AdminConfirmDialog``,
 * ``PromoteToSeriesConfirmDialog``, ``TmdbSuggestionsDialog``,
 * ``InviteUserDialog``, IntroEditor's bulk confirm) renders through
 * this wrapper so tweaks to the surface color, border tint or radius
 * happen in one place instead of fanning out across each consumer.
 */
export function AdminDialog({ PaperProps, ...rest }: DialogProps) {
  const { sx: paperSx, ...paperRest } = PaperProps ?? {};
  return (
    <Dialog
      {...rest}
      PaperProps={{
        ...paperRest,
        sx: [
          {
            bgcolor: "#0d0d0d",
            backgroundImage: "none",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 1.5,
          },
          ...(Array.isArray(paperSx) ? paperSx : paperSx ? [paperSx] : []),
        ],
      }}
    />
  );
}
