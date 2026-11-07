package tw.gov.taipei.goodmorning.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.gov.taipei.goodmorning.dto.LikeStateResponse;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.observability.BusinessMetrics;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class ArtworkLikeService {

    private static final Logger LOGGER = LoggerFactory.getLogger(ArtworkLikeService.class);

    private final ArtworkRepository artworks;
    private final ArtworkLikeRepository likes;
    private final BusinessMetrics metrics;

    public ArtworkLikeService(
            ArtworkRepository artworks,
            ArtworkLikeRepository likes,
            BusinessMetrics metrics) {
        this.artworks = artworks;
        this.likes = likes;
        this.metrics = metrics;
    }

    @Transactional
    public LikeStateResponse like(CurrentUser currentUser, long artworkId) {
        var ownerId = findOwnerId(artworkId);
        if (ownerId.equals(currentUser.id())) {
            throw new ApiException(
                    HttpStatus.CONFLICT,
                    "SELF_LIKE_NOT_ALLOWED",
                    "Authors cannot like their own artwork");
        }

        var changed = likes.insertIfAbsent(currentUser.id(), artworkId) == 1;
        if (changed) {
            artworks.incrementLikeCount(artworkId);
            metrics.artworkLiked();
        }
        var likeCount = artworks.findLikeCountById(artworkId);
        LOGGER.info(
                "artwork_like_set artworkId={} userId={} liked=true changed={} likeCount={}",
                artworkId,
                currentUser.id(),
                changed,
                likeCount);
        return new LikeStateResponse(artworkId, true, likeCount);
    }

    @Transactional
    public LikeStateResponse unlike(CurrentUser currentUser, long artworkId) {
        findOwnerId(artworkId);
        var changed = likes.deleteByUserIdAndArtworkId(currentUser.id(), artworkId) == 1;
        if (changed) {
            artworks.decrementLikeCount(artworkId);
            metrics.artworkUnliked();
        }
        var likeCount = artworks.findLikeCountById(artworkId);
        LOGGER.info(
                "artwork_like_set artworkId={} userId={} liked=false changed={} likeCount={}",
                artworkId,
                currentUser.id(),
                changed,
                likeCount);
        return new LikeStateResponse(artworkId, false, likeCount);
    }

    private Long findOwnerId(long artworkId) {
        return artworks.findOwnerIdById(artworkId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "ARTWORK_NOT_FOUND",
                        "Artwork was not found"));
    }
}
