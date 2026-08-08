import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Box, Snackbar } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { status, whiteAlpha } from "../theme/tokens";

type ToastSeverity = "success" | "error" | "info";

interface ToastContextValue {
  /** Show a transient confirmation toast (defaults to the success tone). */
  showToast: (message: string, severity?: ToastSeverity) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * Lightweight app-wide toast. A single bottom-anchored Snackbar reused
 * for every call, styled like the existing detail-page Snackbars
 * (tinted translucent panel) so confirmations read consistently.
 * Actions like watchlist add/remove and add-to-list use it to give the
 * user feedback that was previously silent.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<{ message: string; severity: ToastSeverity } | null>(null);

  const showToast = useCallback((message: string, severity: ToastSeverity = "success") => {
    setToast({ message, severity });
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  const tone =
    toast?.severity === "error"
      ? status.err
      : toast?.severity === "info"
        ? status.info
        : status.ok;

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Snackbar
        open={!!toast}
        autoHideDuration={3000}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        // Sit above the mobile bottom navigation; fall back to the
        // default offset on larger screens where there is no bottom bar.
        sx={{ bottom: { xs: 76, md: 24 } }}
      >
        {toast ? (
          <Box
            sx={{
              bgcolor: alpha(tone.base, 0.15),
              border: `1px solid ${whiteAlpha(0.1)}`,
              color: "text.primary",
              borderRadius: 1,
              px: 2,
              py: 1.25,
              fontSize: "0.875rem",
              maxWidth: 480,
              backdropFilter: "blur(8px)",
            }}
          >
            {toast.message}
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
