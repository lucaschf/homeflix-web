import { Box, CircularProgress, Typography } from "@mui/material";
import { AlertTriangle, Check, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import { useFollowList, useSharedList } from "../api/hooks";
import { MediaCard } from "../components/MediaCard";
import { AdminButton } from "../components/admin/AdminButton";
import { FancyEmpty } from "../components/admin/FancyEmpty";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { inkAlpha, peachAlpha } from "../theme/tokens";

/**
 * Landing page for a shared custom list (`/lists/shared/:token`).
 *
 * Shows a read-only preview of the list (already access-filtered by the
 * backend to the viewer's libraries) plus a "Follow" action that creates
 * a live follow and drops the viewer into their own "My Lists". Reached
 * only via a share link — the route exists always, but links are only
 * minted when `SHARE_ENABLED` is on.
 */
export function SharedList() {
  const { token = "" } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useSharedList(token);
  const follow = useFollowList();

  useDocumentTitle(data?.list.name ?? t("lists.share.landingEyebrow"));

  if (isLoading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
        <CircularProgress color="primary" />
      </Box>
    );
  }

  if (isError || !data) {
    return (
      <Box sx={{ px: { xs: 3, md: 5 }, pt: { xs: 6, md: 10 } }}>
        <FancyEmpty
          icon={AlertTriangle}
          motif="orbit"
          title={t("lists.share.notFoundTitle")}
          body={t("lists.share.notFoundBody")}
          primary={
            <AdminButton variant="primary" onClick={() => navigate("/lists")}>
              {t("lists.title")}
            </AdminButton>
          }
        />
      </Box>
    );
  }

  const { list, items, hidden_count, is_following } = data;

  const doFollow = () =>
    follow.mutate(token, { onSuccess: () => navigate("/lists") });

  return (
    <Box sx={{ px: { xs: 3, md: 5 }, pt: { xs: 4, md: 6 }, pb: 12, width: "100%" }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          flexWrap: "wrap",
          gap: 3,
          mb: 3.5,
        }}
      >
        <Box sx={{ flex: "1 1 auto", minWidth: 0 }}>
          <Typography variant="eyebrow" sx={{ color: "primary.main", display: "block" }}>
            {t("lists.share.landingEyebrow")}
          </Typography>
          <Typography
            variant="pageTitle"
            sx={{
              mt: 1.25,
              fontSize: { xs: "2.1rem", md: "3rem" },
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            {list.name}
          </Typography>
          {list.description && (
            <Typography variant="pageSubtitle" sx={{ mt: 1.5, color: inkAlpha(0.55) }}>
              {list.description}
            </Typography>
          )}
          <Typography sx={{ mt: 2, fontSize: "0.8rem", color: "text.secondary" }}>
            {list.owner_name && `${t("lists.share.followedBy", { name: list.owner_name })} · `}
            {t("lists.titlesCount", { count: list.item_count })}
          </Typography>
        </Box>

        <AdminButton
          variant="primary"
          icon={is_following ? <Check size={15} /> : <UserPlus size={15} />}
          onClick={doFollow}
          disabled={is_following || follow.isPending}
        >
          {is_following ? t("lists.share.alreadyFollowing") : t("lists.share.follow")}
        </AdminButton>
      </Box>

      {hidden_count > 0 && (
        <Box
          sx={{
            display: "inline-flex",
            alignItems: "center",
            px: 1.25,
            py: 0.6,
            mb: 2.5,
            borderRadius: 1,
            bgcolor: peachAlpha(0.1),
            color: "text.secondary",
            fontSize: "0.75rem",
          }}
        >
          {t("lists.share.hiddenItems", { count: hidden_count })}
        </Box>
      )}

      {items.length > 0 ? (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: {
              xs: "repeat(auto-fill, minmax(140px, 1fr))",
              sm: "repeat(auto-fill, minmax(200px, 1fr))",
              md: "repeat(auto-fill, minmax(240px, 1fr))",
              lg: "repeat(auto-fill, minmax(280px, 1fr))",
            },
            columnGap: { xs: 1.5, md: 2.5 },
            rowGap: { xs: 2.5, md: 3.5 },
          }}
        >
          {items.map((item) => (
            <MediaCard
              key={item.media_id}
              title={item.title}
              imageUrl={item.poster_path ?? undefined}
              year={item.year ?? undefined}
              variant="poster"
              fullWidth
              onClick={() =>
                navigate(item.media_type === "movie" ? `/movie/${item.media_id}` : `/series/${item.media_id}`)
              }
            />
          ))}
        </Box>
      ) : (
        <Typography variant="body1" color="text.secondary" sx={{ py: 6, textAlign: "center" }}>
          {t("lists.listItemsEmpty")}
        </Typography>
      )}
    </Box>
  );
}
