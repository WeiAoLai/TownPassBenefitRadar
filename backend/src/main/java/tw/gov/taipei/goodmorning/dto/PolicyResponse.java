package tw.gov.taipei.goodmorning.dto;

import java.time.LocalDate;

public record PolicyResponse(
        Long id,
        String category,
        String title,
        String slogan,
        String sourceUrl,
        LocalDate startDate,
        LocalDate endDate) {
}
