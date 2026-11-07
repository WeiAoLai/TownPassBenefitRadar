package tw.gov.taipei.goodmorning.dto;

public record LikeStateResponse(long artworkId, boolean liked, long likeCount) {
}
