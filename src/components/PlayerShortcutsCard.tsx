import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import {
  SHORTCUT_GROUPS,
  SPACE_CAP,
  type Shortcut,
} from "../utils/playerShortcuts";
import {
  border,
  fontFamily,
  menuScrim,
  peachAlpha,
  scrim,
  whiteAlpha,
} from "../theme/tokens";

/**
 * The player's keyboard map, as a card over the picture.
 *
 * Deliberately *not* a MUI ``Modal``: the whole point is to read a row
 * and try the key, so the card must not trap focus or stand between the
 * viewer and the player's own ``keydown`` listener. Press `F` with the
 * card up and the player goes fullscreen underneath it.
 *
 * Closing is the player's job (Escape, ``?`` again) plus a click on the
 * scrim — there is nothing to interact with inside, so a stray click on
 * the card itself is far more likely to be someone reading than someone
 * dismissing.
 */
export function PlayerShortcutsCard({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();

  return (
    <Box
      data-testid="shortcuts-scrim"
      onClick={onClose}
      sx={{
        position: "absolute",
        inset: 0,
        // Above every other player surface, the still-watching prompt
        // (14) included: this one is asked for, so nothing covers it.
        zIndex: 20,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: { xs: 1.5, md: 3 },
        bgcolor: scrim(0.72),
        backdropFilter: "blur(3px)",
        animation: "shortcuts-in 160ms ease-out",
        "@keyframes shortcuts-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "@media (prefers-reduced-motion: reduce)": { animation: "none" },
      }}
    >
      <Box
        role="dialog"
        aria-label={t("player.shortcuts.title")}
        onClick={(event) => event.stopPropagation()}
        sx={{
          width: "100%",
          maxWidth: 860,
          maxHeight: "100%",
          overflowY: "auto",
          p: { xs: 2.5, md: 3.5 },
          borderRadius: 2,
          bgcolor: menuScrim(0.97),
          border: `1px solid ${border.hairline}`,
          boxShadow: `0 24px 64px ${scrim(0.55)}`,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: 2,
            mb: { xs: 2, md: 3 },
          }}
        >
          <Typography variant="overlayTitle" color="overlayText.primary">
            {t("player.shortcuts.title")}
          </Typography>
          <Typography variant="eyebrow" color="text.secondary" sx={{ flexShrink: 0 }}>
            {t("player.shortcuts.escToClose")}
          </Typography>
        </Box>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(3, 1fr)" },
            gap: { xs: 2, md: 3 },
          }}
        >
          {SHORTCUT_GROUPS.map((group) => (
            <Box key={group.titleKey}>
              <Typography
                variant="eyebrow"
                color="primary.main"
                sx={{ display: "block", mb: 0.5 }}
              >
                {t(group.titleKey)}
              </Typography>
              {group.items.map((item) => (
                <ShortcutRow key={item.labelKey} item={item} />
              ))}
            </Box>
          ))}
        </Box>

        {/* The one control with no key at all, and the least guessable
            thing in the player. */}
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mt: { xs: 2, md: 3 } }}
        >
          {t("player.shortcuts.wheelHint")}
        </Typography>
      </Box>
    </Box>
  );
}

function ShortcutRow({ item }: { item: Shortcut }) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 1.5,
        py: 0.9,
        borderBottom: `1px solid ${border.hairline}`,
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Typography variant="control" color="overlayText.primary">
        {t(item.labelKey, item.labelValues)}
      </Typography>
      <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }}>
        {item.keys.map((key) => (
          <KeyCap key={key} accent={item.accent}>
            {key === SPACE_CAP ? t("player.shortcuts.spaceKey") : key}
          </KeyCap>
        ))}
      </Box>
    </Box>
  );
}

function KeyCap({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <Box
      component="kbd"
      sx={{
        fontFamily: fontFamily.mono,
        fontSize: "0.6875rem",
        lineHeight: 1.7,
        px: 0.75,
        minWidth: 22,
        textAlign: "center",
        borderRadius: 1,
        whiteSpace: "nowrap",
        color: accent ? "primary.main" : "overlayText.primary",
        bgcolor: accent ? peachAlpha(0.14) : whiteAlpha(0.08),
        border: `1px solid ${accent ? peachAlpha(0.35) : border.hairline}`,
      }}
    >
      {children}
    </Box>
  );
}
