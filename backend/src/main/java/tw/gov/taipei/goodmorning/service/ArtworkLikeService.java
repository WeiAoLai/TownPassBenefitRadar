package tw.gov.taipei.goodmorning.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.gov.taipei.goodmorning.dto.LikeStateResponse;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class ArtworkLikeService {

    private final ArtworkRepository artworks;
    private final ArtworkLikeRepository likes;

    public ArtworkLikeService(ArtworkRepository artworks, ArtworkLikeRepository likes) {
        this.artworks = artworks;
        this.likes = likes;
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

        if (likes.insertIfAbsent(currentUser.id(), artworkId) == 1) {
            artworks.incrementLikeCount(artworkId);
        }
        return new LikeStateResponse(artworkId, true, artworks.findLikeCountById(artworkId));
    }

    @Transactional
    public LikeStateResponse unlike(CurrentUser currentUser, long artworkId) {
        findOwnerId(artworkId);
        if (likes.deleteByUserIdAndArtworkId(currentUser.id(), artworkId) == 1) {
            artworks.decrementLikeCount(artworkId);
        }
        return new LikeStateResponse(artworkId, false, artworks.findLikeCountById(artworkId));
    }

    private Long findOwnerId(long artworkId) {
        return artworks.findOwnerIdById(artworkId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "ARTWORK_NOT_FOUND",
                        "Artwork was not found"));
    }
}
