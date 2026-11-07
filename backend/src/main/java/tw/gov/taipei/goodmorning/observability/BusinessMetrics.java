package tw.gov.taipei.goodmorning.observability;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Component
public class BusinessMetrics {

    private final Counter artworksCreated;
    private final Counter artworksDownloaded;
    private final Counter artworkLikes;
    private final Counter artworkUnlikes;

    public BusinessMetrics(MeterRegistry registry) {
        artworksCreated = Counter.builder("good_morning.artworks.created")
                .description("Number of artwork creation transactions committed")
                .register(registry);
        artworksDownloaded = Counter.builder("good_morning.artworks.downloaded")
                .description("Number of successful non-author artwork downloads")
                .register(registry);
        artworkLikes = Counter.builder("good_morning.artwork.likes")
                .description("Number of effective artwork like state changes")
                .tag("action", "like")
                .register(registry);
        artworkUnlikes = Counter.builder("good_morning.artwork.likes")
                .description("Number of effective artwork like state changes")
                .tag("action", "unlike")
                .register(registry);
    }

    public void artworkCreated() {
        incrementAfterCommit(artworksCreated);
    }

    public void artworkDownloaded() {
        incrementAfterCommit(artworksDownloaded);
    }

    public void artworkLiked() {
        incrementAfterCommit(artworkLikes);
    }

    public void artworkUnliked() {
        incrementAfterCommit(artworkUnlikes);
    }

    private void incrementAfterCommit(Counter counter) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            counter.increment();
            return;
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                counter.increment();
            }
        });
    }
}
