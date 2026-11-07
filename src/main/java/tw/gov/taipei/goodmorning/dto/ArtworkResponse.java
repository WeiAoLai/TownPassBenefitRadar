package tw.gov.taipei.goodmorning.dto;

import java.time.Instant;

public record ArtworkResponse(
        Long id,
        AuthorSummaryResponse owner,
        Long backgroundId,
        Long policyId,
        String sloganText,
        String imageUrl,
        long likeCount,
        long downloadCount,
        boolean likedByMe,
        boolean ownedByMe,
        Instant createdAt) {
}
