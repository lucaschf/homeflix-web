import { useTheme } from "@mui/material/styles";

interface LogoProps {
  size?: number;
  simplified?: boolean;
  fg?: string;
  accent?: string;
  bg?: string;
  title?: string;
}

export function Logo({
  size = 32,
  simplified = false,
  fg = "currentColor",
  accent,
  bg,
  title = "HomeFlix",
}: LogoProps) {
  const theme = useTheme();
  const accentColor = accent ?? theme.palette.primary.main;
  const bgColor = bg ?? theme.palette.background.default;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 6 200 200"
      role="img"
      aria-label={title}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M 100 50 L 172 106 L 164 106 L 164 166 Q 164 176 154 176 L 46 176 Q 36 176 36 166 L 36 106 L 28 106 Z"
        fill={fg}
      />
      <path d="M 130 86 L 130 36 L 168 60 Z" fill={accentColor} />
      {!simplified && (
        <>
          <rect x="84" y="124" width="32" height="32" rx="3" fill={bgColor} />
          <line x1="100" y1="124" x2="100" y2="156" stroke={fg} strokeWidth={2} />
          <line x1="84" y1="140" x2="116" y2="140" stroke={fg} strokeWidth={2} />
        </>
      )}
    </svg>
  );
}
