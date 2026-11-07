package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.observability.BusinessMetrics;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

class ArtworkLikeServiceTest {

    private static final CurrentUser PRINCIPAL =
            new CurrentUser(7L, "demo-user-a", "user-a", "小明");

    private ArtworkRepository artworks;
    private ArtworkLikeRepository likes;
    private BusinessMetrics metrics;
    private ArtworkLikeService service;

    @BeforeEach
    void setUp() {
        artworks = mock(ArtworkRepository.class);
        likes = mock(ArtworkLikeRepository.class);
        metrics = mock(BusinessMetrics.class);
        service = new ArtworkLikeService(artworks, likes, metrics);
    }

    @Test
    void likingAnArtworkInsertsOnceAndIncrementsOnce() {
        when(artworks.findOwnerIdById(10L)).thenReturn(Optional.of(8L));
        when(likes.insertIfAbsent(7L, 10L)).thenReturn(1);
        when(artworks.findLikeCountById(10L)).thenReturn(3L);

        var result = service.like(PRINCIPAL, 10L);

        verify(artworks).incrementLikeCount(10L);
        verify(metrics).artworkLiked();
        assertThat(result.artworkId()).isEqualTo(10L);
        assertThat(result.liked()).isTrue();
        assertThat(result.likeCount()).isEqualTo(3L);
    }

    @Test
    void repeatedLikeDoesNotIncrementAgain() {
        when(artworks.findOwnerIdById(10L)).thenReturn(Optional.of(8L));
        when(likes.insertIfAbsent(7L, 10L)).thenReturn(0);
        when(artworks.findLikeCountById(10L)).thenReturn(3L);

        var result = service.like(PRINCIPAL, 10L);

        verify(artworks, never()).incrementLikeCount(10L);
        verify(metrics, never()).artworkLiked();
        assertThat(result.likeCount()).isEqualTo(3L);
    }

    @Test
    void authorCannotLikeTheirOwnArtwork() {
        when(artworks.findOwnerIdById(10L)).thenReturn(Optional.of(7L));

        assertThatThrownBy(() -> service.like(PRINCIPAL, 10L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.CONFLICT);
                    assertThat(exception.code()).isEqualTo("SELF_LIKE_NOT_ALLOWED");
                });

        verify(likes, never()).insertIfAbsent(7L, 10L);
    }

    @Test
    void unlikingDeletesAndDecrementsOnlyWhenTheLikeExists() {
        when(artworks.findOwnerIdById(10L)).thenReturn(Optional.of(8L));
        when(likes.deleteByUserIdAndArtworkId(7L, 10L)).thenReturn(1);
        when(artworks.findLikeCountById(10L)).thenReturn(2L);

        var result = service.unlike(PRINCIPAL, 10L);

        verify(artworks).decrementLikeCount(10L);
        verify(metrics).artworkUnliked();
        assertThat(result.liked()).isFalse();
        assertThat(result.likeCount()).isEqualTo(2L);
    }

    @Test
    void repeatedUnlikeDoesNotDecrementAgain() {
        when(artworks.findOwnerIdById(10L)).thenReturn(Optional.of(8L));
        when(likes.deleteByUserIdAndArtworkId(7L, 10L)).thenReturn(0);
        when(artworks.findLikeCountById(10L)).thenReturn(2L);

        service.unlike(PRINCIPAL, 10L);

        verify(artworks, never()).decrementLikeCount(10L);
        verify(metrics, never()).artworkUnliked();
    }

    @Test
    void missingArtworkReturnsNotFound() {
        when(artworks.findOwnerIdById(404L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.like(PRINCIPAL, 404L))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    assertThat(exception.status()).isEqualTo(HttpStatus.NOT_FOUND);
                    assertThat(exception.code()).isEqualTo("ARTWORK_NOT_FOUND");
                });
    }
}
