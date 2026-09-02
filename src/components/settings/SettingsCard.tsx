import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { fontSize, whiteAlpha } from "../../theme/tokens";

/**
 * Row grammar for the Settings page (see
 * ``specs/design_handoff_configuracoes``).
 *
 * One card per section; inside it every setting is a row of
 * **label + helper on the left, control on the right**, separated by
 * hairlines. Long lists of settings get labelled groups instead of one
 * undifferentiated stack, so the page can be scanned instead of read.
 *
 * The dividers live on the card rather than on each row so the first row
 * — and the first row after a group label — comes up flush, without any
 * row needing to know where it sits.
 */

const ROW_ATTR = "data-settings-row";
const GROUP_ATTR = "data-settings-group";

/** Section title + one-line hint, sitting above its card. */
export function SettingsSectionHead({ title, hint }: { title: string; hint?: string }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "baseline",
        flexWrap: "wrap",
        gap: 1.25,
        mb: 1.5,
        ml: 0.25,
      }}
    >
      <Typography variant="h3" sx={{ fontSize: "1rem" }}>
        {title}
      </Typography>
      {hint && (
        <Typography variant="body2" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

export function SettingsCard({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        bgcolor: whiteAlpha(0.03),
        borderRadius: 2,
        border: `1px solid ${whiteAlpha(0.06)}`,
        overflow: "hidden",
        [`& > [${ROW_ATTR}]`]: { borderTop: `1px solid ${whiteAlpha(0.05)}` },
        [`& > [${ROW_ATTR}]:first-of-type`]: { borderTop: "none" },
        [`& > [${GROUP_ATTR}] + [${ROW_ATTR}]`]: { borderTop: "none" },
      }}
    >
      {children}
    </Box>
  );
}

/** Uppercase eyebrow splitting a card into labelled groups of rows. */
export function SettingsGroupLabel({ children }: { children: ReactNode }) {
  return (
    <Typography
      {...{ [GROUP_ATTR]: "" }}
      variant="eyebrow"
      sx={{
        display: "block",
        color: "text.secondary",
        fontSize: fontSize.badge,
        letterSpacing: "0.13em",
        pt: 2.25,
        pb: 1.25,
        px: { xs: 2, sm: 2.75 },
      }}
    >
      {children}
    </Typography>
  );
}

interface SettingsRowProps {
  label: ReactNode;
  /** Helper copy — only where the setting is not self-evident. */
  description?: ReactNode;
  /** Id put on the label, for a control to point at with ``labelId``. */
  labelId?: string;
  /**
   * Drop the control below the label instead of beside it — for controls
   * too wide for the right-hand column (the theme grid).
   */
  stack?: boolean;
  children: ReactNode;
}

export function SettingsRow({
  label,
  description,
  labelId,
  stack = false,
  children,
}: SettingsRowProps) {
  return (
    <Box
      {...{ [ROW_ATTR]: "" }}
      sx={{
        display: "grid",
        gridTemplateColumns: stack ? "1fr" : { xs: "1fr", sm: "1fr auto" },
        alignItems: stack ? "stretch" : { xs: "stretch", sm: "center" },
        justifyItems: stack ? "stretch" : { xs: "stretch", sm: "end" },
        gap: stack ? 1.5 : { xs: 1.25, sm: 3 },
        px: { xs: 2, sm: 2.75 },
        py: 1.75,
      }}
    >
      <Box sx={{ justifySelf: "stretch", minWidth: 0 }}>
        <Typography
          id={labelId}
          component="div"
          sx={{ fontSize: "0.9375rem", fontWeight: 600, letterSpacing: "-0.005em" }}
        >
          {label}
        </Typography>
        {description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ mt: 0.5, maxWidth: "46ch", lineHeight: 1.5 }}
          >
            {description}
          </Typography>
        )}
      </Box>
      {children}
    </Box>
  );
}

/**
 * Card footer — a status line on the left, a secondary action on the
 * right. Sits below the last row and carries its own top hairline.
 */
export function SettingsCardFooter({
  status,
  children,
}: {
  status: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        alignItems: "center",
        justifyContent: "space-between",
        px: { xs: 2, sm: 2.75 },
        py: 1.75,
        borderTop: `1px solid ${whiteAlpha(0.05)}`,
        bgcolor: whiteAlpha(0.02),
      }}
    >
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{ display: "flex", alignItems: "center", gap: 1 }}
      >
        <Box
          component="span"
          sx={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            bgcolor: "success.main",
            flexShrink: 0,
          }}
        />
        {status}
      </Typography>
      {children}
    </Box>
  );
}
