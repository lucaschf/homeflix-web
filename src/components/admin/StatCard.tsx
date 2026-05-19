import { Box, ButtonBase, Skeleton, Typography, alpha, useTheme } from "@mui/material";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: ReactNode;
  value?: ReactNode;
  sub?: ReactNode;
  icon?: LucideIcon;
  onClick?: () => void;
  alert?: boolean;
  loading?: boolean;
}

/**
 * Metric tile used on the Overview dashboard. Renders an eyebrow
 * label, a giant Space-Grotesk value, and an optional sub-line.
 *
 * Clickable when ``onClick`` is provided (uses ``ButtonBase`` so we
 * get hover + focus rings + keyboard activation for free). The
 * ``alert`` flag tints the border and the value text peach — used
 * for cards that surface attention items (e.g. "3 needing review").
 */
export function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  onClick,
  alert,
  loading,
}: StatCardProps) {
  const theme = useTheme();
  const baseBorder = alert
    ? alpha(theme.palette.primary.main, 0.35)
    : "rgba(255,255,255,0.08)";

  const content = (
    <Box
      sx={{
        textAlign: "left",
        bgcolor: "rgba(255,255,255,0.025)",
        border: `1px solid ${baseBorder}`,
        borderRadius: 1,
        py: 2.5,
        px: 2.75,
        width: "100%",
        transition: "border-color 140ms ease, background-color 140ms ease",
        ...(onClick && {
          cursor: "pointer",
          "&:hover": {
            bgcolor: "rgba(255,255,255,0.04)",
            borderColor: alert ? baseBorder : "rgba(255,255,255,0.18)",
          },
        }),
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.25,
        }}
      >
        <Typography
          variant="eyebrow"
          sx={{
            color: "text.secondary",
            letterSpacing: "0.16em",
            fontSize: "0.625rem",
          }}
        >
          {label}
        </Typography>
        {Icon && (
          <Icon
            size={26}
            color={alert ? theme.palette.primary.main : theme.palette.text.secondary}
            aria-hidden
          />
        )}
      </Box>
      {loading ? (
        <Skeleton variant="rectangular" width={120} height={32} sx={{ borderRadius: 0.5 }} />
      ) : (
        <Box
          sx={{
            fontFamily: "'Space Grotesk', 'Inter', sans-serif",
            fontSize: "1.875rem",
            fontWeight: 500,
            letterSpacing: "-0.025em",
            color: alert ? "primary.main" : "text.primary",
            lineHeight: 1,
          }}
        >
          {value}
        </Box>
      )}
      {sub && (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: 1, fontSize: "0.78125rem" }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  );

  if (!onClick) return content;

  return (
    <ButtonBase
      onClick={onClick}
      focusRipple
      sx={{
        display: "block",
        width: "100%",
        borderRadius: 1,
        textAlign: "left",
        "&:focus-visible": {
          outline: `2px solid ${theme.palette.primary.main}`,
          outlineOffset: 2,
        },
      }}
    >
      {content}
    </ButtonBase>
  );
}
