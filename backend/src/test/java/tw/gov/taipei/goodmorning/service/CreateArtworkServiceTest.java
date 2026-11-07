package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import software.amazon.awssdk.core.exception.SdkClientException;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.entity.User;
import tw.gov.taipei.goodmorning.exception.ApiException;
import tw.gov.taipei.goodmorning.observability.BusinessMetrics;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.repository.BackgroundRepository;
import tw.gov.taipei.goodmorning.repository.PolicyRepository;
import tw.gov.taipei.goodmorning.repository.UserRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

class CreateArtworkServiceTest {

    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");
    private static final Clock CLOCK = Clock.fixed(
            Instant.parse("2026-11-07T04:00:00Z"), TAIPEI);
    private static final CurrentUser PRINCIPAL =
            new CurrentUser(7L, "demo-user-a", "user-a", "小明");
    private static final byte[] IMAGE = {1, 2, 3};

    private UserRepository users;
    private BackgroundRepository backgrounds;
    private PolicyRepository policies;
    private ArtworkRepository artworks;
    private ObjectStorage storage;
    private PngArtworkValidator validator;
    private BadgeService badges;
    private BusinessMetrics metrics;
    private CreateArtworkService service;
    private User owner;

    @BeforeEach
    void setUp() {
        users = mock(UserRepository.class);
        backgrounds = mock(BackgroundRepository.class);
        policies = mock(PolicyRepository.class);
        artworks = mock(ArtworkRepository.class);
        storage = mock(ObjectStorage.class);
        validator = mock(PngArtworkValidator.class);
        badges = mock(BadgeService.class);
        metrics = mock(BusinessMetrics.class);
        service = new CreateArtworkService(
                users, backgrounds, policies, artworks, storage, validator, badges, metrics, CLOCK);
        owner = new User("demo-user-a", "user-a", "小明");
        when(users.findById(PRINCIPAL.id())).thenReturn(Optional.of(owner));
    }

    @Test
    void rejectsAnInvalidImageBeforeReadingCreationData() {
        var invalid = new ApiException(
                HttpStatus.BAD_REQUEST, "ARTWORK_IMAGE_INVALID", "invalid PNG");
        doThrow(invalid).when(validator).validate(IMAGE);

        assertThatThrownBy(() -> service.create(PRINCIPAL, IMAGE, 1L, 1L, "早安台北"))
                .isSameAs(invalid);

        verify(backgrounds, never()).findById(any());
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void rejectsALockedBackground() {
        when(backgrounds.findById(2L))
                .thenReturn(Optional.of(new Background("限定背景", "backgrounds/locked.png", 4, true)));
        when(artworks.countByOwnerId(PRINCIPAL.id())).thenReturn(3L);

        assertApiError(
                () -> service.create(PRINCIPAL, IMAGE, 2L, 1L, "早安台北"),
                HttpStatus.FORBIDDEN,
                "BACKGROUND_LOCKED");

        verify(policies, never()).findById(any());
        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void rejectsAnInactivePolicy() {
        allowBackground();
        when(policies.findById(3L)).thenReturn(Optional.of(policy(
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), false)));

        assertApiError(
                () -> service.create(PRINCIPAL, IMAGE, 1L, 3L, "早安台北"),
                HttpStatus.FORBIDDEN,
                "POLICY_UNAVAILABLE");

        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void rejectsAnExpiredPolicyUsingTheTaipeiDate() {
        allowBackground();
        when(policies.findById(4L)).thenReturn(Optional.of(policy(
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 11, 6), true)));

        assertApiError(
                () -> service.create(PRINCIPAL, IMAGE, 1L, 4L, "早安台北"),
                HttpStatus.FORBIDDEN,
                "POLICY_UNAVAILABLE");

        verify(storage, never()).put(anyString(), any(), anyString());
    }

    @Test
    void acceptsAnActiveOngoingPolicyWithoutDateBounds() {
        allowBackground();
        when(policies.findById(5L)).thenReturn(Optional.of(policy(null, null, true)));
        when(artworks.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(storage.readUrl(anyString())).thenReturn(URI.create("https://assets.example/artwork.png"));

        var response = service.create(PRINCIPAL, IMAGE, 1L, 5L, "早安台北");

        assertThat(response.policyId()).isEqualTo(5L);
        verify(storage).put(anyString(), any(), anyString());
    }

    @Test
    void mapsAnS3UploadFailureToServiceUnavailable() {
        allowCreationData();
        doThrow(s3Failure()).when(storage).put(anyString(), any(), anyString());

        assertApiError(
                () -> service.create(PRINCIPAL, IMAGE, 1L, 1L, "早安台北"),
                HttpStatus.SERVICE_UNAVAILABLE,
                "STORAGE_UNAVAILABLE");

        verify(artworks, never()).saveAndFlush(any());
    }

    @Test
    void removesTheUploadedObjectWhenReadingItsUrlFails() {
        allowCreationData();
        when(artworks.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        doThrow(s3Failure()).when(storage).readUrl(anyString());

        assertApiError(
                () -> service.create(PRINCIPAL, IMAGE, 1L, 1L, "早安台北"),
                HttpStatus.SERVICE_UNAVAILABLE,
                "STORAGE_UNAVAILABLE");

        var order = inOrder(storage, artworks);
        order.verify(storage).put(anyString(), any(), anyString());
        order.verify(artworks).saveAndFlush(any());
        order.verify(storage).readUrl(anyString());
        order.verify(storage).delete(anyString());
        verify(metrics, never()).artworkCreated();
    }

    @Test
    void deletesTheUploadedObjectAndPreservesTheDatabaseFailure() {
        allowCreationData();
        var databaseFailure = new DataIntegrityViolationException("database failed");
        when(artworks.saveAndFlush(any())).thenThrow(databaseFailure);
        doThrow(s3Failure()).when(storage).delete(anyString());

        assertThatThrownBy(() -> service.create(PRINCIPAL, IMAGE, 1L, 1L, "早安台北"))
                .isSameAs(databaseFailure);

        var order = inOrder(storage, artworks);
        order.verify(storage).put(anyString(), any(), anyString());
        order.verify(artworks).saveAndFlush(any());
        order.verify(storage).delete(anyString());
    }

    @Test
    void uploadsBeforeSavingAndSnapshotsArtworkData() {
        allowCreationData();
        when(artworks.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(artworks.countByOwnerId(PRINCIPAL.id())).thenReturn(1L);
        when(badges.highestBadge(1L))
                .thenReturn(new BadgeResponse(1, "初心傳聲", "https://assets.example/badge.png"));
        when(storage.readUrl(anyString())).thenReturn(URI.create("https://assets.example/artwork.png"));

        var response = service.create(PRINCIPAL, IMAGE, 1L, 1L, "自訂標語");

        var artworkCaptor = ArgumentCaptor.forClass(Artwork.class);
        var order = inOrder(storage, artworks);
        order.verify(storage).put(anyString(), any(), anyString());
        order.verify(artworks).saveAndFlush(artworkCaptor.capture());
        var saved = artworkCaptor.getValue();
        assertThat(saved.getSloganText()).isEqualTo("自訂標語");
        assertThat(saved.getPolicySourceUrl()).isEqualTo("https://example.gov.tw/policy");
        assertThat(saved.getImageObjectKey())
                .startsWith("artworks/7/")
                .endsWith(".png");
        assertThat(response.sloganText()).isEqualTo("自訂標語");
        assertThat(response.imageUrl()).isEqualTo("https://assets.example/artwork.png");
        assertThat(response.ownedByMe()).isTrue();
        verify(metrics).artworkCreated();
    }

    @Test
    void deletesTheUploadedObjectWhenTheTransactionFailsDuringCommit() {
        allowCreationData();
        when(artworks.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
        when(storage.readUrl(anyString())).thenReturn(URI.create("https://assets.example/artwork.png"));
        TransactionSynchronizationManager.initSynchronization();

        try {
            service.create(PRINCIPAL, IMAGE, 1L, 1L, "早安台北");
            var synchronizations = TransactionSynchronizationManager.getSynchronizations();
            assertThat(synchronizations).hasSize(1);

            synchronizations.getFirst().afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);

            verify(storage).delete(anyString());
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private void allowBackground() {
        when(backgrounds.findById(1L))
                .thenReturn(Optional.of(new Background("台北晨曦", "backgrounds/sunrise.png", 0, true)));
        when(artworks.countByOwnerId(PRINCIPAL.id())).thenReturn(0L);
    }

    private void allowCreationData() {
        allowBackground();
        when(policies.findById(1L)).thenReturn(Optional.of(policy(
                LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30), true)));
    }

    private Policy policy(LocalDate startDate, LocalDate endDate, boolean active) {
        return new Policy(
                "社福",
                "敬老政策",
                "政策標語",
                "https://example.gov.tw/policy",
                startDate,
                endDate,
                active);
    }

    private SdkClientException s3Failure() {
        return SdkClientException.create("S3 failed");
    }

    private void assertApiError(
            org.assertj.core.api.ThrowableAssert.ThrowingCallable call,
            HttpStatus status,
            String code) {
        assertThatThrownBy(call).isInstanceOfSatisfying(ApiException.class, exception -> {
            assertThat(exception.status()).isEqualTo(status);
            assertThat(exception.code()).isEqualTo(code);
        });
    }
}
