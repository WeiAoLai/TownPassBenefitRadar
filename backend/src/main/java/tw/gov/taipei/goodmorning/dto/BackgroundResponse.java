package tw.gov.taipei.goodmorning.dto;

public record BackgroundResponse(
        Long id, String name, String imageUrl, int unlockThreshold, boolean unlocked) {
}
