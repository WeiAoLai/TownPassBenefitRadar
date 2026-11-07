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
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.User;
import tw.gov.taipei.goodmorning.observability.BusinessMetrics;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

class DownloadArtworkServiceTest {

    private static final byte[] SOURCE_PNG = {1, 2, 3};
    private static final byte[] COMPOSED_PNG = {4, 5, 6};
    private static final CurrentUser AUTHOR =
            new CurrentUser(7L, "author-subject", "author", "作者");
    private static final CurrentUser VIEWER =
            new CurrentUser(8L, "viewer-subject", "viewer", "讀者");

    private ArtworkRepository artworks;
    private ObjectStorage storage;
    private QrCodeComposer composer;
    private BusinessMetrics metrics;
    private DownloadArtworkService service;
    private Artwork artwork;

    @BeforeEach
    void setUp() {
        artworks = mock(ArtworkRepository.class);
        storage = mock(ObjectStorage.class);
        composer = mock(QrCodeComposer.class);
        metrics = mock(BusinessMetrics.class);
        service = new DownloadArtworkService(artworks, storage, composer, metrics);

        var owner = mock(User.class);
        when(owner.getId()).thenReturn(7L);
        artwork = mock(Artwork.class);
        when(artwork.getOwner()).thenReturn(owner);
        when(artwork.getImageObjectKey()).thenReturn("artworks/7/source.png");
        when(artwork.getPolicySourceUrl()).thenReturn("https://example.gov.tw/snapshotted-policy");
        when(artworks.findById(42L)).thenReturn(Optional.of(artwork));
        when(storage.get("artworks/7/source.png")).thenReturn(SOURCE_PNG);
        when(composer.compose(SOURCE_PNG, "https://example.gov.tw/snapshotted-policy"))
                .thenReturn(COMPOSED_PNG);
    }

    @Test
    void authorCanDownloadWithoutIncreasingTheCount() {
        var download = service.download(AUTHOR, 42L);

        assertThat(download.content()).isEqualTo(COMPOSED_PNG);
        assertThat(download.filename()).isEqualTo("artwork-42.png");
        verify(artworks, never()).incrementDownloadCount(42L);
        verify(metrics, never()).artworkDownloaded();
    }

    @Test
    void nonAuthorDownloadAtomicallyIncreasesTheCountAfterComposition() {
        var download = service.download(VIEWER, 42L);

        assertThat(download.content()).isEqualTo(COMPOSED_PNG);
        verify(artworks).incrementDownloadCount(42L);
        verify(metrics).artworkDownloaded();
    }

    @Test
    void failedCompositionDoesNotIncreaseTheCount() {
        when(composer.compose(SOURCE_PNG, "https://example.gov.tw/snapshotted-policy"))
                .thenThrow(new IllegalStateException("broken image"));

        assertThatThrownBy(() -> service.download(VIEWER, 42L))
                .isInstanceOf(IllegalStateException.class);

        verify(artworks, never()).incrementDownloadCount(42L);
        verify(metrics, never()).artworkDownloaded();
    }
}
