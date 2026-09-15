import type { Theme } from "@mui/material/styles";
import { getScheme, secondaryAccentFor } from "../../theme/colors";

/**
 * Color of the "chosen" state in the profile form: the checked library
 * cards and the age-limit ladder. It is the scheme's secondary accent
 * where the scheme has one (teal in "warmteal"), so a choice reads apart
 * from the primary Save button, and the primary accent otherwise.
 */
export const selectionAccent = (theme: Theme): string =>
  secondaryAccentFor(getScheme())?.main ?? theme.palette.primary.main;
