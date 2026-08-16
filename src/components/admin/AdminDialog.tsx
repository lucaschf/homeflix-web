import { Dialog, type DialogProps } from "@mui/material";

/**
 * Shared MUI ``Dialog`` wrapper for admin modals. The surface color,
 * elevation overlay and hairline border now come from the global
 * ``MuiDialog`` theme override (the shared StatCard surface); this
 * wrapper only pins the slightly tighter ``1.5`` border radius the
 * design uses for confirm/picker modals.
 *
 * Every admin dialog (``AdminConfirmDialog``,
 * ``PromoteToSeriesConfirmDialog``, ``TmdbSuggestionsDialog``,
 * ``InviteUserDialog``, IntroEditor's bulk confirm) renders through
 * this wrapper so the radius stays in one place.
 */
export function AdminDialog({ PaperProps, ...rest }: DialogProps) {
  const { sx: paperSx, ...paperRest } = PaperProps ?? {};
  return (
    <Dialog
      {...rest}
      PaperProps={{
        ...paperRest,
        sx: [
          { borderRadius: 1.5 },
          ...(Array.isArray(paperSx) ? paperSx : paperSx ? [paperSx] : []),
        ],
      }}
    />
  );
}
