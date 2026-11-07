package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.Test;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.repository.BackgroundRepository;

class BackgroundServiceTest {

    @Test
    void returnsActiveBackgroundsIncludingLockedOnes() {
        var repository = mock(BackgroundRepository.class);
        when(repository.findByActiveTrueOrderByUnlockThresholdAscIdAsc()).thenReturn(List.of(
                new Background("免費", "backgrounds/free.png", 0, true),
                new Background("進階", "backgrounds/locked.png", 4, true)));
        var service = new BackgroundService(
                repository, objectKey -> URI.create("https://assets.example/" + objectKey));

        var responses = service.listBackgrounds(2);

        assertThat(responses).extracting(response -> response.unlocked())
                .containsExactly(true, false);
    }
}
