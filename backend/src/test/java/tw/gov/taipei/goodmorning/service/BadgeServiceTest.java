package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.URI;
import java.util.stream.Stream;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;

class BadgeServiceTest {

    private final BadgeService service =
            new BadgeService(objectKey -> URI.create("https://assets.example/" + objectKey));

    @ParameterizedTest
    @MethodSource("badgeBoundaries")
    void returnsTheHighestBadgeReached(long artworkCount, Integer expectedLevel) {
        var badge = service.highestBadge(artworkCount);

        if (expectedLevel == null) {
            assertThat(badge).isNull();
        } else {
            assertThat(badge.level()).isEqualTo(expectedLevel);
            assertThat(badge.iconUrl()).isEqualTo(
                    "https://assets.example/badges/%d/badge.png".formatted(expectedLevel));
        }
    }

    private static Stream<Arguments> badgeBoundaries() {
        return Stream.of(
                Arguments.of(0, null),
                Arguments.of(1, 1),
                Arguments.of(2, 2),
                Arguments.of(3, 2),
                Arguments.of(4, 3),
                Arguments.of(8, 4),
                Arguments.of(16, 5),
                Arguments.of(32, 6),
                Arguments.of(64, 7),
                Arguments.of(128, 8),
                Arguments.of(256, 9),
                Arguments.of(511, 9),
                Arguments.of(512, 10));
    }
}
