package tw.gov.taipei.goodmorning.observability;

import static org.assertj.core.api.Assertions.assertThat;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

class BusinessMetricsTest {

    private final SimpleMeterRegistry registry = new SimpleMeterRegistry();
    private final BusinessMetrics metrics = new BusinessMetrics(registry);

    @Test
    void recordsLowCardinalityBusinessEvents() {
        metrics.artworkCreated();
        metrics.artworkDownloaded();
        metrics.artworkLiked();
        metrics.artworkUnliked();

        assertThat(counter("good_morning.artworks.creation")).isEqualTo(1);
        assertThat(counter("good_morning.artworks.downloaded")).isEqualTo(1);
        assertThat(counter("good_morning.artwork.likes", "action", "like")).isEqualTo(1);
        assertThat(counter("good_morning.artwork.likes", "action", "unlike")).isEqualTo(1);
    }

    @Test
    void recordsAnEventOnlyAfterTheTransactionCommits() {
        TransactionSynchronizationManager.initSynchronization();

        try {
            metrics.artworkCreated();

            assertThat(counter("good_morning.artworks.creation")).isZero();
            assertThat(TransactionSynchronizationManager.getSynchronizations()).hasSize(1);

            TransactionSynchronizationManager.getSynchronizations().getFirst().afterCommit();

            assertThat(counter("good_morning.artworks.creation")).isEqualTo(1);
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    @Test
    void doesNotRecordAnEventWhenTheTransactionRollsBack() {
        TransactionSynchronizationManager.initSynchronization();

        try {
            metrics.artworkDownloaded();
            var synchronization = TransactionSynchronizationManager.getSynchronizations().getFirst();

            synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);

            assertThat(counter("good_morning.artworks.downloaded")).isZero();
        } finally {
            TransactionSynchronizationManager.clearSynchronization();
        }
    }

    private double counter(String name, String... tags) {
        return registry.get(name).tags(tags).counter().count();
    }
}
