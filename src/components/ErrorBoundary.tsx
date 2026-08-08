import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Typography } from "@mui/material";
import { RotateCcw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

/**
 * Top-level error boundary. A render error anywhere below it would
 * otherwise unmount the whole tree and leave a blank page; instead we
 * show a friendly fallback with a reload so the user can recover.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // No external logging is wired up; surface it to the console so a
    // crash is at least diagnosable in dev / from a user's report.
    console.error("Unhandled render error:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}

function ErrorFallback() {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        px: 3,
        textAlign: "center",
        bgcolor: "background.default",
      }}
    >
      <Typography variant="h5" sx={{ fontWeight: 600 }}>
        {t("errorBoundary.title")}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 420 }}>
        {t("errorBoundary.body")}
      </Typography>
      <Button
        variant="contained"
        startIcon={<RotateCcw size={16} />}
        onClick={() => window.location.reload()}
        sx={{ mt: 1 }}
      >
        {t("errorBoundary.reload")}
      </Button>
    </Box>
  );
}
