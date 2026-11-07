package tw.gov.taipei.goodmorning.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;
import software.amazon.awssdk.core.exception.SdkException;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.dto.AuthorSummaryResponse;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.observability.BusinessMetrics;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.repository.BackgroundRepository;
import tw.gov.taipei.goodmorning.repository.PolicyRepository;
import tw.gov.taipei.goodmorning.repository.UserRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class CreateArtworkService {

    private static final Logger LOGGER = LoggerFactory.getLogger(CreateArtworkService.class);
    private static final String PNG_CONTENT_TYPE = "image/png";

    private final UserRepository users;
    private final BackgroundRepository backgrounds;
    private final PolicyRepository policies;
    private final ArtworkRepository artworks;
    private final ObjectStorage storage;
    private final PngArtworkValidator imageValidator;
    private final BadgeService badges;
    private final BusinessMetrics metrics;
    private final Clock clock;

    public CreateArtworkService(
            UserRepository users,
            BackgroundRepository backgrounds,
            PolicyRepository policies,
            ArtworkRepository artworks,
            ObjectStorage storage,
            PngArtworkValidator imageValidator,
            BadgeService badges,
            BusinessMetrics metrics,
            Clock clock) {
        this.users = users;
        this.backgrounds = backgrounds;
        this.policies = policies;
        this.artworks = artworks;
        this.storage = storage;
        this.imageValidator = imageValidator;
        this.badges = badges;
        this.metrics = metrics;
        this.clock = clock;
    }

    @Transactional
    public ArtworkResponse create(
            CurrentUser principal,
            byte[] image,
            long backgroundId,
            long policyId,
            String sloganText) {
        imageValidator.validate(image);
        validateSlogan(sloganText);

        var owner = users.findById(principal.id())
                .orElseThrow(() -> new IllegalStateException("Authenticated user no longer exists"));
        var background = backgrounds.findById(backgroundId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "BACKGROUND_NOT_FOUND",
                        "Background was not found"));
        validateBackground(background, artworks.countByOwnerId(principal.id()));

        var policy = policies.findById(policyId)
                .orElseThrow(() -> new ApiException(
                        HttpStatus.NOT_FOUND,
                        "POLICY_NOT_FOUND",
                        "Policy was not found"));
        validatePolicy(policy);

        var objectKey = "artworks/%d/%s.png".formatted(principal.id(), UUID.randomUUID());
        putImage(objectKey, image);
        var cleanupNeeded = new AtomicBoolean(true);
        registerRollbackCleanup(objectKey, cleanupNeeded);

        try {
            var artwork = artworks.saveAndFlush(new Artwork(
                    owner,
                    background,
                    policy,
                    sloganText,
                    policy.getSourceUrl(),
                    objectKey));
            var artworkCount = artworks.countByOwnerId(principal.id());
            var response = new ArtworkResponse(
                    artwork.getId(),
                    new AuthorSummaryResponse(
                            principal.id(), principal.displayName(), badges.highestBadge(artworkCount)),
                    backgroundId,
                    policyId,
                    sloganText,
                    readUrl(objectKey),
                    artwork.getLikeCount(),
                    artwork.getDownloadCount(),
                    false,
                    true,
                    artwork.getCreatedAt());
            metrics.artworkCreated();
            LOGGER.info(
                    "artwork_created artworkId={} ownerId={} backgroundId={} policyId={}",
                    artwork.getId(),
                    principal.id(),
                    backgroundId,
                    policyId);
            return response;
        } catch (RuntimeException originalFailure) {
            deleteAfterFailure(objectKey, cleanupNeeded, originalFailure);
            throw originalFailure;
        }
    }

    private void validateSlogan(String sloganText) {
        if (!StringUtils.hasText(sloganText) || sloganText.length() > 500) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "VALIDATION_FAILED",
                    "Slogan text must contain 1 to 500 characters");
        }
    }

    private void validateBackground(Background background, long artworkCount) {
        if (!background.isActive()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "BACKGROUND_UNAVAILABLE",
                    "Background is not available");
        }
        if (artworkCount < background.getUnlockThreshold()) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "BACKGROUND_LOCKED",
                    "Background has not been unlocked");
        }
    }

    private void validatePolicy(Policy policy) {
        var today = LocalDate.now(clock);
        if (!policy.isActive()
                || (policy.getStartDate() != null && today.isBefore(policy.getStartDate()))
                || (policy.getEndDate() != null && today.isAfter(policy.getEndDate()))) {
            throw new ApiException(
                    HttpStatus.FORBIDDEN,
                    "POLICY_UNAVAILABLE",
                    "Policy is not currently available");
        }
    }

    private void putImage(String objectKey, byte[] image) {
        try {
            storage.put(objectKey, image, PNG_CONTENT_TYPE);
        } catch (SdkException exception) {
            throw storageUnavailable(exception);
        }
    }

    private String readUrl(String objectKey) {
        try {
            return storage.readUrl(objectKey).toString();
        } catch (SdkException exception) {
            throw storageUnavailable(exception);
        }
    }

    private ApiException storageUnavailable(SdkException cause) {
        return new ApiException(
                HttpStatus.SERVICE_UNAVAILABLE,
                "STORAGE_UNAVAILABLE",
                "Object storage is temporarily unavailable",
                cause);
    }

    private void registerRollbackCleanup(String objectKey, AtomicBoolean cleanupNeeded) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED) {
                    deleteAfterFailure(objectKey, cleanupNeeded, null);
                }
            }
        });
    }

    private void deleteAfterFailure(
            String objectKey,
            AtomicBoolean cleanupNeeded,
            RuntimeException originalFailure) {
        if (!cleanupNeeded.compareAndSet(true, false)) {
            return;
        }
        try {
            storage.delete(objectKey);
        } catch (RuntimeException cleanupFailure) {
            cleanupNeeded.set(true);
            if (originalFailure != null) {
                originalFailure.addSuppressed(cleanupFailure);
            }
            LOGGER.warn("Failed to remove S3 object after artwork creation failure: {}", objectKey);
        }
    }
}
