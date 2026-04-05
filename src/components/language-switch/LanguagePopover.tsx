import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import {
  Box,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Popover,
  Typography,
} from "@mui/material";

const languageOptions = [
  { value: "pt-BR", label: "Portugues (Brasil)", flag: "/flags/flag-br.svg" },
  { value: "en", label: "English", flag: "/flags/flag-us.svg" },
];

interface LanguagePopoverProps {
  anchorEl: HTMLElement | null;
  open: boolean;
  onClose: () => void;
}

export function LanguagePopover({ anchorEl, open, onClose }: LanguagePopoverProps) {
  const { i18n } = useTranslation();

  const handleChange = useCallback(
    async (language: string) => {
      onClose();
      await i18n.changeLanguage(language);
      localStorage.setItem("homeflix-language", language);
    },
    [onClose, i18n],
  );

  return (
    <Popover
      anchorEl={anchorEl}
      anchorOrigin={{ horizontal: "right", vertical: "bottom" }}
      transformOrigin={{ horizontal: "right", vertical: "top" }}
      disableScrollLock
      onClose={onClose}
      open={open}
      slotProps={{ paper: { sx: { width: 200, mt: 1 } } }}
    >
      {languageOptions.map((option) => (
        <MenuItem
          key={option.value}
          onClick={() => handleChange(option.value)}
          selected={i18n.language === option.value}
        >
          <ListItemIcon>
            <Box
              sx={{
                width: 24,
                height: 18,
                borderRadius: 0.5,
                overflow: "hidden",
                "& img": { width: "100%", height: "100%", objectFit: "cover" },
              }}
            >
              <img alt={option.label} src={option.flag} />
            </Box>
          </ListItemIcon>
          <ListItemText
            primary={
              <Typography variant="body2" fontWeight={i18n.language === option.value ? 600 : 400}>
                {option.label}
              </Typography>
            }
          />
        </MenuItem>
      ))}
    </Popover>
  );
}
