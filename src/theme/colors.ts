import { alpha } from "@mui/material/styles";

interface ColorScale {
  lightest: string;
  light: string;
  main: string;
  dark: string;
  darkest: string;
  contrastText: string;
  alpha4: string;
  alpha8: string;
  alpha12: string;
  alpha30: string;
  alpha50: string;
}

const withAlphas = (color: Omit<ColorScale, `alpha${string}`>): ColorScale => ({
  ...color,
  alpha4: alpha(color.main, 0.04),
  alpha8: alpha(color.main, 0.08),
  alpha12: alpha(color.main, 0.12),
  alpha30: alpha(color.main, 0.3),
  alpha50: alpha(color.main, 0.5),
});

export const neutral = {
  50: "#FAFAFA",
  100: "#F5F5F5",
  200: "#E8E8E8",
  300: "#D4D4D4",
  400: "#A0A0A0",
  500: "#737373",
  600: "#525252",
  700: "#2A2A2A",
  800: "#1A1A1A",
  900: "#141414",
  950: "#0D0D0D",
};

export const peach = withAlphas({
  lightest: "#FFF5F0",
  light: "#F0A889",
  main: "#E8926F",
  dark: "#D47A57",
  darkest: "#B85A3D",
  contrastText: "#0D0D0D",
});

export const success = withAlphas({
  lightest: "#DCFCE7",
  light: "#86EFAC",
  main: "#4ADE80",
  dark: "#22C55E",
  darkest: "#14532D",
  contrastText: "#FFFFFF",
});

export const info = withAlphas({
  lightest: "#E0F2FE",
  light: "#7DD3FC",
  main: "#60A5FA",
  dark: "#3B82F6",
  darkest: "#1E40AF",
  contrastText: "#FFFFFF",
});

export const warning = withAlphas({
  lightest: "#FEF3C7",
  light: "#FDE047",
  main: "#FBBF24",
  dark: "#F59E0B",
  darkest: "#78350F",
  contrastText: "#0D0D0D",
});

export const error = withAlphas({
  lightest: "#FEE2E2",
  light: "#FCA5A5",
  main: "#F87171",
  dark: "#EF4444",
  darkest: "#7F1D1D",
  contrastText: "#FFFFFF",
});
