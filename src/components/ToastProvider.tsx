import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Box, Button, Snackbar } from "@mui/material";
import { toastSurfaceSx } from "../theme/tokens";

type ToastSeverity = "success" | "error" | "info";

interface ToastOptions {
  severity?: ToastSeverity;
  /** Optional inline action (e.g. "Undo"). Running it dismisses the toast. */
  action?: { label: string; onClick: () => void };
  /** Auto-hide delay in ms (default 3000; give undo toasts a longer window). */
  durationMs?: number;
}

interface ToastState {
  message: string;
  severity: ToastSeverity;
  action?: { label: string; onClick: () => void };
  durationMs: number;
}

interface ToastContextValue {
  /** Show a transient toast (defaults to the success tone). */
  showToast: (message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Lightweight app-wide toast. A single bottom-anchored Snackbar reused
 * for every call, styled like the existing detail-page Snackbars
 * (tinted translucent panel) so confirmations read consistently.
 * Actions like watchlist add/remove and add-to-list use it for feedback
 * that was previously silent; destructive actions can pass an ``action``
 * (e.g. Undo) with a longer ``durationMs``.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, options?: ToastOptions) => {
    setToast({
      message,
      severity: options?.severity ?? "success",
      action: options?.action,
      durationMs: options?.durationMs ?? 3000,
    });
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={toast?.durationMs ?? 3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        // Sit above the mobile bottom navigation; fall back to the
        // default offset on larger screens where there is no bottom bar.
        sx={{ bottom: { xs: 76, md: 24 } }}
      >
        {toast ? (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              ...toastSurfaceSx(toast.severity),
              color: "text.primary",
              borderRadius: 1,
              pl: 2,
              pr: toast.action ? 1 : 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
              backdropFilter: "blur(8px)",
            }}
          >
            <Box component="span" sx={{ minWidth: 0 }}>
              {toast.message}
            </Box>
            {toast.action && (
              <Button
                size="small"
                onClick={() => {
                  toast.action?.onClick();
                  setToast(null);
                }}
                sx={{
                  flexShrink: 0,
                  color: "primary.main",
                  fontWeight: 600,
                  textTransform: "none",
                  minWidth: "auto",
                  px: 1,
                }}
              >
                {toast.action.label}
              </Button>
            )}
          </Box>
        ) : undefined}
      </Snackbar>
    </ToastContext.Provider>
  );
}

// Provider + hook live together (idiomatic React context); the hook is
// the only non-component export, so fast-refresh's "components only"
// rule is relaxed for it.
// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}
