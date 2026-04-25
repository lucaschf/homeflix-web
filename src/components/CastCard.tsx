import { Avatar, Box, Typography } from "@mui/material";
import type { CastMemberOutput } from "../api/types";

interface CastCardProps {
  member: CastMemberOutput;
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
 * One actor entry in the cast carousel: avatar (photo or initials
 * fallback) + bold name + optional character role caption.
 *
 * Designed to be rendered as a child of ``<MediaCarousel>`` so the
 * cast section gets the same hover-arrows + hidden-scrollbar
 * behaviour as the genre carousels elsewhere in the app — keeping
 * the navigation pattern consistent across all horizontal lists.
 *
 * Card width / avatar size are responsive: 110×80 on mobile,
 * 144×116 on ``md+`` so actor faces carry more visual weight on
 * desktop without crowding phones.
 */
export function CastCard({ member }: CastCardProps) {
  return (
    <Box
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
  );
}
