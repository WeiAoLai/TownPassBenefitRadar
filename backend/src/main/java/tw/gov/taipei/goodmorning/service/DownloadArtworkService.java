package tw.gov.taipei.goodmorning.service;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import software.amazon.awssdk.core.exception.SdkException;
import tw.gov.taipei.goodmorning.dto.ArtworkDownload;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class DownloadArtworkService {

    private final ArtworkRepository artworks;
    private final ObjectStorage storage;
    private final QrCodeComposer composer;

    public DownloadArtworkService(
            ArtworkRepository artworks,
            ObjectStorage storage,
            QrCodeComposer composer) {
        this.artworks = artworks;
        this.storage = storage;
        this.composer = composer;
    }

    @Transactional
    public ArtworkDownload download(CurrentUser currentUser, long artworkId) {
        var artwork = artworks.findById(artworkId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "ARTWORK_NOT_FOUND",
                        "Artwork was not found"));

        var source = getSource(artwork.getImageObjectKey());
        var composed = composer.compose(source, artwork.getPolicySourceUrl());
        if (!artwork.getOwner().getId().equals(currentUser.id())) {
            artworks.incrementDownloadCount(artworkId);
        }
        return new ArtworkDownload(composed, "artwork-%d.png".formatted(artworkId));
    }

    private byte[] getSource(String objectKey) {
        try {
            return storage.get(objectKey);
        } catch (SdkException exception) {
            throw new ApiException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "STORAGE_UNAVAILABLE",
                    "Object storage is temporarily unavailable",
                    exception);
        }
    }
}
