import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminSettingDetail } from "../../../api/types";
import {
  fontFamily,
  fontSize,
  peachAlpha,
  status as statusPalette,
  whiteAlpha,
} from "../../../theme/tokens";
import { SettingsCardSwitch } from "./SettingsCardSwitch";
import { SettingsSectionContext } from "./SettingsSectionContext";
import {
  type SettingsSectionMeta,
  sectionMatches,
  sectionTitle,
} from "./settingsSections";

export interface SettingsLayoutProps {
  sections: { meta: SettingsSectionMeta; detail: AdminSettingDetail }[];
  dirtyMap: Record<string, boolean>;
  reportDirty: (id: string) => (dirty: boolean) => void;
  query: string;
  onQueryChange: (next: string) => void;
  onSuccess: (message: string) => void;
  onError: (message: string) => void;
}

const HASH0 =
  typeof window !== "undefined" ? decodeURIComponent(window.location.hash.slice(1)) : "";

/** Left section-nav (258px) + a single visible section pane. */
export function SettingsRailLayout({
  sections,
  dirtyMap,
  reportDirty,
  query,
  onQueryChange,
  onSuccess,
  onError,
}: SettingsLayoutProps) {
  const { t } = useTranslation();
  const [active, setActive] = useState<string>(
    () => sections.find((s) => s.meta.id === HASH0)?.meta.id ?? sections[0]?.meta.id ?? "",
  );

  const select = (id: string) => {
    setActive(id);
    if (typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", `#${id}`);
    }
  };

  const navList = sections.filter((s) => sectionMatches(t, s.meta, query));

  return (
    <Box sx={{ display: "flex", gap: 0, minHeight: 0, alignItems: "flex-start" }}>
      <Box
        component="nav"
        sx={{
          width: 258,
          flexShrink: 0,
          borderRight: `1px solid ${whiteAlpha(0.08)}`,
          pr: 1.5,
          pb: 3,
        }}
      >
        <TextField
          size="small"
          fullWidth
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder={t("admin.settings.searchPlaceholder")}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search size={15} aria-hidden />
              </InputAdornment>
            ),
            sx: {
              fontSize: fontSize.control,
              bgcolor: whiteAlpha(0.025),
              "& .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.08) },
              "&:hover .MuiOutlinedInput-notchedOutline": { borderColor: whiteAlpha(0.16) },
            },
          }}
          sx={{ mb: 1.5 }}
        />
        <Typography
          sx={{
            display: "block",
            fontFamily: fontFamily.mono,
            fontSize: fontSize.micro,
            letterSpacing: "0.14em",
            color: "text.secondary",
            px: 1.5,
            pb: 1,
          }}
        >
          {t("admin.settings.sectionsLabel")}
        </Typography>

        {navList.map(({ meta }) => {
          const on = meta.id === active;
          const dirty = !!dirtyMap[meta.id];
          const Icon = meta.icon;
          return (
            <Box
              key={meta.id}
              component="button"
              onClick={() => select(meta.id)}
              sx={{
                position: "relative",
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 1.375,
                textAlign: "left",
                px: 1.5,
                py: 1.25,
                mb: "2px",
                border: "none",
                borderRadius: 1,
                background: on ? peachAlpha(0.12) : "transparent",
                color: on ? "text.primary" : whiteAlpha(0.62),
                cursor: "pointer",
                transition: "background 120ms ease",
                "&:hover": { background: on ? peachAlpha(0.12) : whiteAlpha(0.04) },
              }}
            >
              {on && (
                <Box
                  aria-hidden
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: 9,
                    bottom: 9,
                    width: 3,
                    borderRadius: 3,
                    bgcolor: "primary.main",
                  }}
                />
              )}
              <Box
                sx={{ display: "flex", color: on ? "primary.main" : whiteAlpha(0.4) }}
              >
                <Icon size={16} aria-hidden />
              </Box>
              <Box
                component="span"
                sx={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: fontSize.control,
                  fontWeight: on ? 600 : 500,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {sectionTitle(t, meta)}
              </Box>
              {dirty ? (
                <Box
                  aria-hidden
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    bgcolor: "primary.main",
                    boxShadow: `0 0 0 3px ${peachAlpha(0.16)}`,
                    flexShrink: 0,
                  }}
                />
              ) : (
                meta.scope === "admin" && (
                  <Box
                    aria-hidden
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: statusPalette.ok.base,
                      opacity: 0.7,
                      flexShrink: 0,
                    }}
                  />
                )
              )}
            </Box>
          );
        })}
        {navList.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ px: 1.5, py: 1 }}>
            {t("admin.settings.noSections")}
          </Typography>
        )}
      </Box>

      <Box sx={{ flex: 1, minWidth: 0, pl: { xs: 3, lg: 5 } }}>
        {sections.map(({ meta, detail }) => (
          <Box key={meta.id} sx={{ display: meta.id === active ? "block" : "none" }}>
            <SettingsSectionContext.Provider
              value={{
                variant: "rail",
                scope: meta.scope,
                reportDirty: reportDirty(meta.id),
              }}
            >
              <SettingsCardSwitch
                key={detail.updated_at ?? "default"}
                detail={detail}
                onSuccess={onSuccess}
                onError={onError}
              />
            </SettingsSectionContext.Provider>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
