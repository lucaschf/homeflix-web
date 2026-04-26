import { Avatar, Box, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
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
 * Clicking a card navigates to the actor's "movies featuring this
 * actor" page (``/actor/<name>``). The actor's profile photo is
 * forwarded via ``location.state`` so the destination header can
 * render the same avatar without an extra round-trip — when the
 * user lands directly on the URL (bookmark / share) the page
 * gracefully degrades to initials.
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
  const navigate = useNavigate();
  const goToActor = () => {
    navigate(`/actor/${encodeURIComponent(member.name)}`, {
      state: {
        profilePath: member.profile_path,
        // Forwarded so the actor page can fetch bio without an extra
        // round-trip — the source movie's cast already carries the
        // person id from TMDB enrichment.
        tmdbId: member.tmdb_id,
      },
    });
  };
  return (
    <Box
      onClick={goToActor}
      role="link"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goToActor();
        }
      }}
      sx={{
        flex: "0 0 auto",
        width: { xs: 110, md: 144 },
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
        cursor: "pointer",
        outline: "none",
        // Lift the name on hover so the click affordance is obvious
        // even though the avatar already grows under the hover state.
        "&:hover .cast-name, &:focus-visible .cast-name": {
          color: "primary.main",
        },
        "&:focus-visible .cast-avatar": {
          // Subtle focus ring without an outline rectangle that would
          // clip awkwardly around a circular avatar.
          boxShadow: "0 0 0 2px rgba(232,146,111,0.6)",
        },
      }}
    >
      <Avatar
        className="cast-avatar"
        src={member.profile_path ?? undefined}
        alt={member.name}
        sx={{
          width: { xs: 80, md: 116 },
          height: { xs: 80, md: 116 },
          mb: 1,
          bgcolor: "rgba(255,255,255,0.08)",
          fontSize: { xs: "1.25rem", md: "1.6rem" },
          fontWeight: 600,
          transition: "box-shadow 150ms ease",
        }}
      >
        {initialsFor(member.name)}
      </Avatar>
      <Typography
        className="cast-name"
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
          transition: "color 150ms ease",
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
