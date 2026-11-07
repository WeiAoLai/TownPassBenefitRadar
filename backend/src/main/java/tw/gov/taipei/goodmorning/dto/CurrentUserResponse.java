package tw.gov.taipei.goodmorning.dto;

import java.time.Instant;

public record CurrentUserResponse(
        Long id,
        String account,
        String displayName,
        long artworkCount,
        BadgeResponse badge,
        Instant createdAt) {
}
