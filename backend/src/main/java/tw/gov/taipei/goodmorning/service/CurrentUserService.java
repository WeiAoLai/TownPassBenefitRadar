package tw.gov.taipei.goodmorning.service;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tw.gov.taipei.goodmorning.config.DemoUserProperties.DemoUser;
import tw.gov.taipei.goodmorning.dto.CurrentUserResponse;
import tw.gov.taipei.goodmorning.entity.User;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.repository.UserRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

@Service
public class CurrentUserService {

    private final UserRepository users;
    private final ArtworkRepository artworks;
    private final BadgeService badgeService;

    public CurrentUserService(
            UserRepository users, ArtworkRepository artworks, BadgeService badgeService) {
        this.users = users;
        this.artworks = artworks;
        this.badgeService = badgeService;
    }

    @Transactional
    public CurrentUser resolveDemoUser(DemoUser demoUser) {
        var user = users.findBySsoSubject(demoUser.ssoSubject())
                .orElseGet(() -> users.save(new User(
                        demoUser.ssoSubject(), demoUser.account(), demoUser.displayName())));

        return new CurrentUser(
                user.getId(), user.getSsoSubject(), user.getAccount(), user.getDisplayName());
    }

    @Transactional(readOnly = true)
    public CurrentUserResponse getCurrentUser(CurrentUser principal) {
        var user = users.findById(principal.id())
                .orElseThrow(() -> new IllegalStateException("Authenticated user no longer exists"));
        var artworkCount = artworks.countByOwnerId(user.getId());

        return new CurrentUserResponse(
                user.getId(),
                user.getAccount(),
                user.getDisplayName(),
                artworkCount,
                badgeService.highestBadge(artworkCount),
                user.getCreatedAt());
    }

    @Transactional(readOnly = true)
    public long getArtworkCount(CurrentUser principal) {
        return artworks.countByOwnerId(principal.id());
    }
}
