import { Box, InputAdornment, TextField, Typography } from "@mui/material";
import { ChevronDown, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AdminBadge } from "../../../components/admin";
import { fontSize, peachAlpha, whiteAlpha } from "../../../theme/tokens";
import type { SettingsLayoutProps } from "./SettingsRailLayout";
import { SettingsCardSwitch } from "./SettingsCardSwitch";
import { SettingsSectionContext } from "./SettingsSectionContext";
import { sectionMatches, sectionSummary, sectionTitle } from "./settingsSections";

const HASH0 =
  typeof window !== "undefined" ? decodeURIComponent(window.location.hash.slice(1)) : "";

/** Full-width stacked cards; exactly one expands at a time. */
export function SettingsAccordionLayout({
  sections,
  dirtyMap,
  reportDirty,
  query,
  onQueryChange,
  onSuccess,
  onError,
}: SettingsLayoutProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState<string | null>(
    () => sections.find((s) => s.meta.id === HASH0)?.meta.id ?? sections[0]?.meta.id ?? null,
  );

  const toggle = (id: string) => {
    const next = open === id ? null : id;
    setOpen(next);
    if (next && typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", `#${next}`);
    }
  };

  const anyMatch = sections.some((s) => sectionMatches(t, s.meta, query));

  return (
    <Box>
      <TextField
        size="small"
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
        sx={{ maxWidth: 440, width: "100%", mb: 2 }}
      />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
        {sections.map(({ meta, detail }) => {
          const isOpen = meta.id === open;
          const dirty = !!dirtyMap[meta.id];
          const Icon = meta.icon;
          const matches = sectionMatches(t, meta, query);
          return (
            <Box
              key={meta.id}
              sx={{
                display: matches ? "block" : "none",
                border: `1px solid ${whiteAlpha(0.08)}`,
                borderRadius: 1.75,
                bgcolor: whiteAlpha(0.015),
                overflow: "hidden",
              }}
            >
              <Box
                component="button"
                onClick={() => toggle(meta.id)}
                aria-expanded={isOpen}
                sx={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.625,
                  px: 2.75,
                  py: 2.25,
                  border: "none",
                  background: "none",
                  textAlign: "left",
                  cursor: "pointer",
                  color: "text.primary",
                }}
              >
                <Box sx={{ display: "flex", color: "primary.main" }}>
                  <Icon size={18} aria-hidden />
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, flexWrap: "wrap" }}>
                    <Typography variant="h3" component="span" sx={{ fontSize: "1.0625rem" }}>
                      {sectionTitle(t, meta)}
                    </Typography>
                    <AdminBadge tone={meta.scope === "admin" ? "ok" : "neutral"}>
                      {t(`admin.settings.scope.${meta.scope}`)}
                    </AdminBadge>
                    {dirty && (
                      <Box
                        aria-hidden
                        sx={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          bgcolor: "primary.main",
                          boxShadow: `0 0 0 3px ${peachAlpha(0.16)}`,
                        }}
                      />
                    )}
                  </Box>
                  {!isOpen && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        display: "block",
                        mt: 0.5,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {sectionSummary(t, meta)}
                    </Typography>
                  )}
                </Box>
                <Box
                  aria-hidden
                  sx={{
                    display: "flex",
                    color: "text.secondary",
                    transform: isOpen ? "rotate(180deg)" : "none",
                    transition: "transform 200ms ease",
                  }}
                >
                  <ChevronDown size={18} />
                </Box>
              </Box>
              {/* Body stays mounted while collapsed (hidden) so the
                  section keeps its unsaved edits + dirty dot. */}
              <Box sx={{ display: isOpen ? "block" : "none", px: 2.75, pb: 2.75 }}>
                <SettingsSectionContext.Provider
                  value={{
                    variant: "accordion",
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
            </Box>
          );
        })}
        {!anyMatch && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 3 }}>
            {t("admin.settings.noSectionsQuery", { query })}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
