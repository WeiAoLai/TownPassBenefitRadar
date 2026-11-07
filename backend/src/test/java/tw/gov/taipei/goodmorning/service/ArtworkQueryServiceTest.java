package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.entity.User;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

class ArtworkQueryServiceTest {

    private static final CurrentUser PRINCIPAL =
            new CurrentUser(7L, "demo-user-a", "user-a", "小明");

    private ArtworkRepository artworks;
    private ArtworkLikeRepository likes;
    private ObjectUrlProvider objectUrls;
    private BadgeService badges;
    private ArtworkQueryService service;

    @BeforeEach
    void setUp() {
        artworks = mock(ArtworkRepository.class);
        likes = mock(ArtworkLikeRepository.class);
        objectUrls = mock(ObjectUrlProvider.class);
        badges = mock(BadgeService.class);
        service = new ArtworkQueryService(artworks, likes, objectUrls, badges);
    }

    @Test
    void listsPublicArtworksWithViewerAndAuthorState() {
        var artwork = artwork(10L, 8L, "作者乙");
        var pageable = PageRequest.of(0, 20);
        when(artworks.findAllByOrderByCreatedAtDescIdDesc(pageable))
                .thenReturn(new PageImpl<>(List.of(artwork), pageable, 1));
        when(likes.findArtworkIdsByUserIdAndArtworkIdIn(7L, Set.of(10L)))
                .thenReturn(Set.of(10L));
        when(artworks.countByOwnerId(8L)).thenReturn(4L);
        when(badges.highestBadge(4L))
                .thenReturn(new BadgeResponse(3, "四方送暖", "https://assets.example/badge.png"));
        when(objectUrls.readUrl("artworks/8/10.png"))
                .thenReturn(URI.create("https://assets.example/artwork.png"));

        var response = service.listPublic(PRINCIPAL, 0, 20);

        assertThat(response.content()).hasSize(1);
        var item = response.content().getFirst();
        assertThat(item.id()).isEqualTo(10L);
        assertThat(item.owner().displayName()).isEqualTo("作者乙");
        assertThat(item.owner().badge().level()).isEqualTo(3);
        assertThat(item.likedByMe()).isTrue();
        assertThat(item.ownedByMe()).isFalse();
        assertThat(response.totalElements()).isEqualTo(1);
        assertThat(response.totalPages()).isEqualTo(1);
    }

    @Test
    void listsOnlyTheCurrentUsersArtworks() {
        var artwork = artwork(11L, 7L, "小明");
        var pageable = PageRequest.of(1, 10);
        when(artworks.findByOwnerIdOrderByCreatedAtDescIdDesc(7L, pageable))
                .thenReturn(new PageImpl<>(List.of(artwork), pageable, 11));
        when(likes.findArtworkIdsByUserIdAndArtworkIdIn(7L, Set.of(11L)))
                .thenReturn(Set.of());
        when(artworks.countByOwnerId(7L)).thenReturn(11L);
        when(objectUrls.readUrl("artworks/7/11.png"))
                .thenReturn(URI.create("https://assets.example/mine.png"));

        var response = service.listMine(PRINCIPAL, 1, 10);

        assertThat(response.content().getFirst().ownedByMe()).isTrue();
        assertThat(response.page()).isEqualTo(1);
        assertThat(response.size()).isEqualTo(10);
        verify(artworks).findByOwnerIdOrderByCreatedAtDescIdDesc(7L, pageable);
    }

    @Test
    void returnsArtworkDetails() {
        var artwork = artwork(12L, 8L, "作者乙");
        when(artworks.findDetailedById(12L)).thenReturn(Optional.of(artwork));
        when(likes.existsByUserIdAndArtworkId(7L, 12L)).thenReturn(true);
        when(artworks.countByOwnerId(8L)).thenReturn(1L);
        when(objectUrls.readUrl("artworks/8/12.png"))
                .thenReturn(URI.create("https://assets.example/detail.png"));

        var response = service.get(PRINCIPAL, 12L);

        assertThat(response.id()).isEqualTo(12L);
        assertThat(response.likedByMe()).isTrue();
        assertThat(response.imageUrl()).isEqualTo("https://assets.example/detail.png");
    }

    @Test
    void missingArtworkReturnsNotFound() {
        when(artworks.findDetailedById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.get(PRINCIPAL, 404L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(exception.code()).isEqualTo("ARTWORK_NOT_FOUND");
                });
    }

    @Test
    void rejectsPagesOutsideTheContract() {
        assertThatThrownBy(() -> service.listPublic(PRINCIPAL, 0, 101))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.BAD_REQUEST);
                    assertThat(exception.code()).isEqualTo("PAGE_INVALID");
                });
        assertThatThrownBy(() -> service.listPublic(PRINCIPAL, -1, 20))
                .isInstanceOf(ApiException.class);
        verify(artworks, org.mockito.Mockito.never())
                .findAllByOrderByCreatedAtDescIdDesc(any());
    }

    private Artwork artwork(long artworkId, long ownerId, String displayName) {
        var owner = mock(User.class);
        when(owner.getId()).thenReturn(ownerId);
        when(owner.getDisplayName()).thenReturn(displayName);
        var background = mock(Background.class);
        when(background.getId()).thenReturn(1L);
        var policy = mock(Policy.class);
        when(policy.getId()).thenReturn(2L);
        var artwork = mock(Artwork.class);
        when(artwork.getId()).thenReturn(artworkId);
        when(artwork.getOwner()).thenReturn(owner);
        when(artwork.getBackground()).thenReturn(background);
        when(artwork.getPolicy()).thenReturn(policy);
        when(artwork.getSloganText()).thenReturn("早安台北");
        when(artwork.getImageObjectKey()).thenReturn("artworks/%d/%d.png".formatted(ownerId, artworkId));
        when(artwork.getLikeCount()).thenReturn(3L);
        when(artwork.getDownloadCount()).thenReturn(5L);
        when(artwork.getCreatedAt()).thenReturn(Instant.parse("2026-11-07T04:00:00Z"));
        return artwork;
    }
}
