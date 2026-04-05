import { Box, IconButton, Tooltip } from "@mui/material";
import { useTranslation } from "react-i18next";
import { usePopover } from "../../hooks/usePopover";
import { LanguagePopover } from "./LanguagePopover";

const flags: Record<string, string> = {
  "pt-BR": "/flags/flag-br.svg",
  en: "/flags/flag-us.svg",
};

export function LanguageSwitch() {
  const { i18n } = useTranslation();
  const popover = usePopover();

  const currentFlag = flags[i18n.language] || flags.en;

  return (
    <>
      <Tooltip title="Language">
        <IconButton onClick={popover.handleOpen} ref={popover.anchorRef} size="small">
          <Box
            sx={{
              width: 24,
              height: 18,
              borderRadius: 0.5,
              overflow: "hidden",
              "& img": { width: "100%", height: "100%", objectFit: "cover" },
            }}
          >
            <img alt="Language" src={currentFlag} />
          </Box>
        </IconButton>
      </Tooltip>
      <LanguagePopover
        anchorEl={popover.anchorRef.current}
        open={popover.open}
        onClose={popover.handleClose}
      />
    </>
  );
}
