package tw.gov.taipei.goodmorning.service;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.dto.AuthorSummaryResponse;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;
import tw.gov.taipei.goodmorning.dto.LeaderboardEntryResponse;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class LeaderboardService {

    private final ArtworkRepository artworks;
    private final ArtworkLikeRepository likes;
    private final ObjectUrlProvider objectUrls;
    private final BadgeService badges;

    public LeaderboardService(
            ArtworkRepository artworks,
            ArtworkLikeRepository likes,
            ObjectUrlProvider objectUrls,
            BadgeService badges) {
        this.artworks = artworks;
        this.likes = likes;
        this.objectUrls = objectUrls;
        this.badges = badges;
    }

    @Transactional(readOnly = true)
    public List<LeaderboardEntryResponse> get(CurrentUser currentUser) {
        var ranking = artworks.findLeaderboard();
        if (ranking.isEmpty()) {
            return List.of();
        }

        var artworkIds = ranking.stream()
                .map(row -> row.getArtworkId())
                .collect(Collectors.toSet());
        var artworkById = artworks.findAllDetailedByIdIn(artworkIds).stream()
                .collect(Collectors.toMap(Artwork::getId, Function.identity()));
        var likedIds = likes.findArtworkIdsByUserIdAndArtworkIdIn(currentUser.id(), artworkIds);
        var authorBadges = new HashMap<Long, BadgeResponse>();

        return ranking.stream()
                .map(row -> new LeaderboardEntryResponse(
                        row.getRanking(),
                        row.getScore(),
                        mapArtwork(
                                currentUser,
                                artworkById.get(row.getArtworkId()),
                                likedIds,
                                authorBadges)))
                .toList();
    }

    private ArtworkResponse mapArtwork(
            CurrentUser currentUser,
            Artwork artwork,
            Set<Long> likedIds,
            Map<Long, BadgeResponse> authorBadges) {
        var owner = artwork.getOwner();
        var ownerId = owner.getId();
        if (!authorBadges.containsKey(ownerId)) {
            authorBadges.put(ownerId, badges.highestBadge(artworks.countByOwnerId(ownerId)));
        }
        return new ArtworkResponse(
                artwork.getId(),
                new AuthorSummaryResponse(
                        ownerId, owner.getDisplayName(), authorBadges.get(ownerId)),
                artwork.getBackground().getId(),
                artwork.getPolicy().getId(),
                artwork.getSloganText(),
                objectUrls.readUrl(artwork.getImageObjectKey()).toString(),
                artwork.getLikeCount(),
                artwork.getDownloadCount(),
                likedIds.contains(artwork.getId()),
                ownerId.equals(currentUser.id()),
                artwork.getCreatedAt());
    }
}
