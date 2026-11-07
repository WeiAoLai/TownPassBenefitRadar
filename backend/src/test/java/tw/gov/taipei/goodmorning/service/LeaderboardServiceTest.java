package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.entity.User;
import tw.gov.taipei.goodmorning.repository.ArtworkLikeRepository;
import tw.gov.taipei.goodmorning.repository.ArtworkRanking;
import tw.gov.taipei.goodmorning.repository.ArtworkRepository;
import tw.gov.taipei.goodmorning.security.CurrentUser;

class LeaderboardServiceTest {

    @Test
    void mapsRankingArtworkCurrentUserStateAndAuthorBadge() {
        var artworks = mock(ArtworkRepository.class);
        var likes = mock(ArtworkLikeRepository.class);
        var urls = mock(ObjectUrlProvider.class);
        var badges = mock(BadgeService.class);
        var service = new LeaderboardService(artworks, likes, urls, badges);
        var currentUser = new CurrentUser(7L, "viewer", "viewer", "讀者");

        var ranking = mock(ArtworkRanking.class);
        when(ranking.getArtworkId()).thenReturn(42L);
        when(ranking.getRanking()).thenReturn(2L);
        when(ranking.getScore()).thenReturn(9L);
        var owner = mock(User.class);
        when(owner.getId()).thenReturn(8L);
        when(owner.getDisplayName()).thenReturn("作者");
        var background = mock(Background.class);
        when(background.getId()).thenReturn(3L);
        var policy = mock(Policy.class);
        when(policy.getId()).thenReturn(4L);
        var artwork = mock(Artwork.class);
        when(artwork.getId()).thenReturn(42L);
        when(artwork.getOwner()).thenReturn(owner);
        when(artwork.getBackground()).thenReturn(background);
        when(artwork.getPolicy()).thenReturn(policy);
        when(artwork.getSloganText()).thenReturn("早安台北");
        when(artwork.getImageObjectKey()).thenReturn("artworks/8/42.png");
        when(artwork.getLikeCount()).thenReturn(9L);
        when(artwork.getDownloadCount()).thenReturn(5L);
        when(artwork.getCreatedAt()).thenReturn(Instant.parse("2026-11-07T04:00:00Z"));
        when(artworks.findLeaderboard()).thenReturn(List.of(ranking));
        when(artworks.findAllDetailedByIdIn(Set.of(42L))).thenReturn(List.of(artwork));
        when(likes.findArtworkIdsByUserIdAndArtworkIdIn(7L, Set.of(42L)))
                .thenReturn(Set.of(42L));
        when(artworks.countByOwnerId(8L)).thenReturn(4L);
        when(badges.highestBadge(4L))
                .thenReturn(new BadgeResponse(3, "四方送暖", "https://assets.example/badge.png"));
        when(urls.readUrl("artworks/8/42.png"))
                .thenReturn(URI.create("https://assets.example/42.png"));

        var result = service.get(currentUser);

        assertThat(result).hasSize(1);
        assertThat(result.getFirst().rank()).isEqualTo(2L);
        assertThat(result.getFirst().score()).isEqualTo(9L);
        assertThat(result.getFirst().artwork().likedByMe()).isTrue();
        assertThat(result.getFirst().artwork().ownedByMe()).isFalse();
        assertThat(result.getFirst().artwork().owner().badge().level()).isEqualTo(3);
    }
}
