package tw.gov.taipei.goodmorning.service;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.gov.taipei.goodmorning.dto.ArtworkPageResponse;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.dto.AuthorSummaryResponse;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class ArtworkQueryService {

    private final ArtworkRepository artworks;
    private final ArtworkLikeRepository likes;
    private final ObjectUrlProvider objectUrls;
    private final BadgeService badges;

    public ArtworkQueryService(
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
    public ArtworkPageResponse listPublic(CurrentUser currentUser, int page, int size) {
        validatePage(page, size);
        var result = artworks.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(page, size));
        return mapPage(currentUser, result);
    }

    @Transactional(readOnly = true)
    public ArtworkPageResponse listMine(CurrentUser currentUser, int page, int size) {
        validatePage(page, size);
        var result = artworks.findByOwnerIdOrderByCreatedAtDescIdDesc(
                currentUser.id(), PageRequest.of(page, size));
        return mapPage(currentUser, result);
    }

    @Transactional(readOnly = true)
    public ArtworkResponse get(CurrentUser currentUser, long artworkId) {
        var artwork = artworks.findDetailedById(artworkId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "ARTWORK_NOT_FOUND",
                        "Artwork was not found"));
        var likedByMe = likes.existsByUserIdAndArtworkId(currentUser.id(), artworkId);
        return mapArtwork(currentUser, artwork, likedByMe, new HashMap<>());
    }

    private ArtworkPageResponse mapPage(CurrentUser currentUser, Page<Artwork> page) {
        var artworkIds = page.getContent().stream()
                .map(Artwork::getId)
                .collect(Collectors.toSet());
        var likedIds = artworkIds.isEmpty()
                ? Set.<Long>of()
                : likes.findArtworkIdsByUserIdAndArtworkIdIn(currentUser.id(), artworkIds);
        var authorBadges = new HashMap<Long, BadgeResponse>();
        var content = page.getContent().stream()
                .map(artwork -> mapArtwork(
                        currentUser,
                        artwork,
                        likedIds.contains(artwork.getId()),
                        authorBadges))
                .toList();
        return new ArtworkPageResponse(
                content,
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages());
    }

    private ArtworkResponse mapArtwork(
            CurrentUser currentUser,
            Artwork artwork,
            boolean likedByMe,
            Map<Long, BadgeResponse> authorBadges) {
        var owner = artwork.getOwner();
        var ownerId = owner.getId();
        var badge = badgeFor(ownerId, authorBadges);
        return new ArtworkResponse(
                artwork.getId(),
                new AuthorSummaryResponse(ownerId, owner.getDisplayName(), badge),
                artwork.getBackground().getId(),
                artwork.getPolicy().getId(),
                artwork.getSloganText(),
                objectUrls.readUrl(artwork.getImageObjectKey()).toString(),
                artwork.getLikeCount(),
                artwork.getDownloadCount(),
                likedByMe,
                ownerId.equals(currentUser.id()),
                artwork.getCreatedAt());
    }

    private BadgeResponse badgeFor(Long ownerId, Map<Long, BadgeResponse> authorBadges) {
        if (!authorBadges.containsKey(ownerId)) {
            var artworkCount = artworks.countByOwnerId(ownerId);
            authorBadges.put(ownerId, badges.highestBadge(artworkCount));
        }
        return authorBadges.get(ownerId);
    }

    private void validatePage(int page, int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "PAGE_INVALID",
                    "Page must be at least 0 and size must be between 1 and 100");
        }
    }
}
