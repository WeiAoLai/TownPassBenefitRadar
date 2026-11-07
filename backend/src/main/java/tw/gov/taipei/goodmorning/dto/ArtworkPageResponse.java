package tw.gov.taipei.goodmorning.dto;

import java.util.List;

public record ArtworkPageResponse(
        List<ArtworkResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages) {
}
