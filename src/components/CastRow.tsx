import { Avatar, Box, Typography } from "@mui/material";
import type { CastMemberOutput } from "../api/types";

interface CastRowProps {
  members: CastMemberOutput[];
}

/** Compute initials from a person's name for the photo fallback.
 *
 * Takes the first letter of the first and last word — covers
 * "Leonardo DiCaprio" → "LD" and single-word names ("Madonna" → "M")
 * without choking on extra whitespace.
 */
function initialsFor(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const parts = trimmed.split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * Horizontal scrollable row of cast members with avatar + name + role.
 *
 * Each member renders as a fixed-width card so long names don't push
 * the layout around; long names truncate with ellipsis. The row scrolls
 * horizontally on overflow with a thin native scrollbar — touch
 * devices handle this naturally and desktop users get the bar.
 *
 * Returns ``null`` for an empty list so the caller can keep its
 * surrounding section header without wrapping in a conditional.
 */
export function CastRow({ members }: CastRowProps) {
  if (members.length === 0) return null;

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        overflowX: "auto",
        overflowY: "hidden",
        pb: 1,
        // Subtle native scrollbar styling — visible on hover so the
        // row doesn't reserve dead space below itself when not
        // overflowing.
        scrollbarWidth: "thin",
        "&::-webkit-scrollbar": { height: 6 },
        "&::-webkit-scrollbar-thumb": {
          bgcolor: "rgba(255,255,255,0.15)",
          borderRadius: 3,
        },
      }}
    >
      {members.map((member) => (
        <Box
          key={`${member.name}-${member.role ?? ""}`}
          sx={{
            flex: "0 0 auto",
            width: { xs: 110, md: 144 },
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          <Avatar
            src={member.profile_path ?? undefined}
            alt={member.name}
            sx={{
              width: { xs: 80, md: 116 },
              height: { xs: 80, md: 116 },
              mb: 1,
              bgcolor: "rgba(255,255,255,0.08)",
              fontSize: { xs: "1.25rem", md: "1.6rem" },
              fontWeight: 600,
            }}
          >
            {initialsFor(member.name)}
          </Avatar>
          <Typography
            variant="body2"
            fontWeight={600}
            sx={{
              fontSize: { xs: "0.8rem", md: "0.85rem" },
              lineHeight: 1.2,
              width: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {member.name}
          </Typography>
          {member.role && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                fontSize: { xs: "0.7rem", md: "0.75rem" },
                lineHeight: 1.2,
                mt: 0.25,
                width: "100%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
              }}
            >
              {member.role}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}
