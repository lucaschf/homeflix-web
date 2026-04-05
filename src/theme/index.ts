import { createTheme, type ThemeOptions } from "@mui/material/styles";
import { error, info, neutral, peach, success, warning } from "./colors";

const themeOptions: ThemeOptions = {
  colorSchemes: {
    dark: {
      palette: {
        primary: peach,
        error,
        info,
        success,
        warning,
        background: {
          default: neutral[950],
          paper: neutral[900],
        },
        text: {
          primary: neutral[50],
          secondary: neutral[400],
          disabled: neutral[600],
        },
        divider: neutral[700],
        action: {
          active: neutral[400],
          hover: `rgba(255, 255, 255, 0.08)`,
          selected: `rgba(255, 255, 255, 0.16)`,
          disabled: `rgba(255, 255, 255, 0.3)`,
          disabledBackground: `rgba(255, 255, 255, 0.12)`,
        },
      },
    },
  },
  defaultColorScheme: "dark",
  typography: {
    fontFamily: "'Inter', system-ui, sans-serif",
    h1: { fontSize: "1.75rem", fontWeight: 700, lineHeight: 1.3 },
    h2: { fontSize: "1.375rem", fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: "1.125rem", fontWeight: 600, lineHeight: 1.4 },
    body1: { fontSize: "0.875rem", lineHeight: 1.5 },
    body2: { fontSize: "0.75rem", lineHeight: 1.5 },
    caption: { fontSize: "0.6875rem", fontWeight: 500, lineHeight: 1.4 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: neutral[950],
          scrollbarColor: `${neutral[700]} transparent`,
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
          borderRadius: 12,
          border: `1px solid ${neutral[700]}`,
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: neutral[900],
          borderRight: `1px solid ${neutral[700]}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: neutral[900],
          backgroundImage: "none",
          borderBottom: `1px solid ${neutral[700]}`,
        },
      },
    },
  },
};

export const theme = createTheme(themeOptions);
