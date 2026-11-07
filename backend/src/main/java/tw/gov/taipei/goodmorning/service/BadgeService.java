package tw.gov.taipei.goodmorning.service;

import java.util.List;
import org.springframework.stereotype.Service;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;

@Service
public class BadgeService {

    private static final List<BadgeDefinition> BADGES = List.of(
            new BadgeDefinition(1, "初心傳聲", 1),
            new BadgeDefinition(2, "雙喜分享", 2),
            new BadgeDefinition(3, "四方送暖", 4),
            new BadgeDefinition(4, "八方傳福", 8),
            new BadgeDefinition(5, "鄰里好手", 16),
            new BadgeDefinition(6, "社區達人", 32),
            new BadgeDefinition(7, "城市傳聲", 64),
            new BadgeDefinition(8, "政策推手", 128),
            new BadgeDefinition(9, "全民分享家", 256),
            new BadgeDefinition(10, "長輩圖典藏家", 512));

    private final ObjectUrlProvider objectStorage;

    public BadgeService(ObjectUrlProvider objectStorage) {
        this.objectStorage = objectStorage;
    }

    public BadgeResponse highestBadge(long artworkCount) {
        for (int index = BADGES.size() - 1; index >= 0; index--) {
            var badge = BADGES.get(index);
            if (artworkCount >= badge.threshold()) {
                var key = "badges/%d/badge.png".formatted(badge.level());
                return new BadgeResponse(
                        badge.level(), badge.name(), objectStorage.readUrl(key).toString());
            }
        }
        return null;
    }

    private record BadgeDefinition(int level, String name, long threshold) {
    }
}
