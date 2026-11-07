package tw.gov.taipei.goodmorning.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.ArtworkLike;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.entity.User;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.ArtworkLikeService;

@SpringBootTest
@Testcontainers
@Transactional
class RepositoryIntegrationTest {

    @Container
    private static final MariaDBContainer<?> MARIADB =
            new MariaDBContainer<>("mariadb:11.4")
                    .withDatabaseName("good_morning_repository_test")
                    .withUsername("good_morning")
                    .withPassword("good_morning");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MARIADB::getJdbcUrl);
        registry.add("spring.datasource.username", MARIADB::getUsername);
        registry.add("spring.datasource.password", MARIADB::getPassword);
    }

    @Autowired
    private UserRepository users;

    @Autowired
    private BackgroundRepository backgrounds;

    @Autowired
    private PolicyRepository policies;

    @Autowired
    private ArtworkRepository artworks;

    @Autowired
    private ArtworkLikeRepository artworkLikes;

    @Autowired
    private ArtworkLikeService artworkLikeService;

    @Test
    void ssoSubjectMustBeUnique() {
        users.saveAndFlush(new User("subject-1", "account-1", "User One"));

        assertThatThrownBy(() ->
                        users.saveAndFlush(new User("subject-1", "account-2", "User Two")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void findsOnlyActivePoliciesAvailableOnTheGivenDate() {
        var today = LocalDate.of(2026, 11, 7);
        var available = policies.save(new Policy(
                "福利", "敬老卡", "日日好行", "https://example.gov.tw/available",
                today.minusDays(1), today.plusDays(1), true));
        var future = policies.save(new Policy(
                "福利", "尚未開始", "敬請期待", "https://example.gov.tw/future",
                today.plusDays(1), today.plusDays(2), true));
        var expired = policies.save(new Policy(
                "福利", "已結束", "活動結束", "https://example.gov.tw/expired",
                today.minusDays(2), today.minusDays(1), true));
        var inactive = policies.save(new Policy(
                "福利", "未啟用", "尚未啟用", "https://example.gov.tw/inactive",
                today.minusDays(1), today.plusDays(1), false));
        policies.flush();

        assertThat(policies.findAvailableOn(today))
                .extracting(Policy::getId)
                .contains(available.getId())
                .doesNotContain(future.getId(), expired.getId(), inactive.getId());
    }

    @Test
    void pagesArtworksNewestFirstWithIdAsStableTieBreaker() {
        var fixtures = createArtworkFixtures();
        var created = new ArrayList<Artwork>();
        for (int index = 1; index <= 4; index++) {
            created.add(artworks.saveAndFlush(new Artwork(
                    fixtures.owner(), fixtures.background(), fixtures.policy(),
                    "標語 " + index, fixtures.policy().getSourceUrl(),
                    "artworks/test/" + index + ".png")));
        }

        var page = artworks.findAllByOrderByCreatedAtDescIdDesc(PageRequest.of(0, 2));

        assertThat(page.getTotalElements()).isEqualTo(4);
        assertThat(page.getContent())
                .extracting(Artwork::getId)
                .containsExactly(created.get(3).getId(), created.get(2).getId());
        assertThat(artworks.findDetailedById(created.getFirst().getId()))
                .hasValueSatisfying(found ->
                        assertThat(found.getOwner().getDisplayName()).isEqualTo("Owner"));
    }

    @Test
    void returnsTheDatabaseGeneratedArtworkTimestampAfterInsert() {
        var fixtures = createArtworkFixtures();

        var artwork = artworks.saveAndFlush(new Artwork(
                fixtures.owner(), fixtures.background(), fixtures.policy(),
                "早安台北", fixtures.policy().getSourceUrl(),
                "artworks/test/generated-timestamp.png"));

        assertThat(artwork.getCreatedAt()).isNotNull();
    }

    @Test
    void userCanLikeAnArtworkOnlyOnce() {
        var fixtures = createArtworkFixtures();
        var artwork = artworks.saveAndFlush(new Artwork(
                fixtures.owner(), fixtures.background(), fixtures.policy(),
                "早安台北", fixtures.policy().getSourceUrl(), "artworks/test/liked.png"));
        artworkLikes.saveAndFlush(new ArtworkLike(fixtures.owner(), artwork));

        assertThat(artworkLikes.findArtworkIdsByUserIdAndArtworkIdIn(
                        fixtures.owner().getId(), java.util.Set.of(artwork.getId())))
                .containsExactly(artwork.getId());

        assertThatThrownBy(() ->
                        artworkLikes.saveAndFlush(new ArtworkLike(fixtures.owner(), artwork)))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void likeAndUnlikeOperationsAreIdempotentAgainstMariaDb() {
        var fixtures = createArtworkFixtures();
        var artwork = artworks.saveAndFlush(new Artwork(
                fixtures.owner(), fixtures.background(), fixtures.policy(),
                "早安台北", fixtures.policy().getSourceUrl(), "artworks/test/idempotent.png"));
        var liker = users.saveAndFlush(new User("liker-subject", "liker-account", "Liker"));
        var principal = new CurrentUser(
                liker.getId(), liker.getSsoSubject(), liker.getAccount(), liker.getDisplayName());

        var firstLike = artworkLikeService.like(principal, artwork.getId());
        var repeatedLike = artworkLikeService.like(principal, artwork.getId());
        var firstUnlike = artworkLikeService.unlike(principal, artwork.getId());
        var repeatedUnlike = artworkLikeService.unlike(principal, artwork.getId());

        assertThat(firstLike.likeCount()).isEqualTo(1);
        assertThat(repeatedLike.likeCount()).isEqualTo(1);
        assertThat(firstUnlike.likeCount()).isZero();
        assertThat(repeatedUnlike.likeCount()).isZero();
    }

    @Test
    @Transactional(propagation = Propagation.NOT_SUPPORTED)
    void concurrentLikesIncrementTheCounterOnlyOnce() throws Exception {
        var owner = users.saveAndFlush(new User("concurrent-owner", "concurrent-owner", "Owner"));
        var liker = users.saveAndFlush(new User("concurrent-liker", "concurrent-liker", "Liker"));
        var background = backgrounds.saveAndFlush(
                new Background("Concurrent", "backgrounds/concurrent.png", 0, true));
        var policy = policies.saveAndFlush(new Policy(
                "測試", "Concurrent", "Test", "https://example.gov.tw/concurrent",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), true));
        var artwork = artworks.saveAndFlush(new Artwork(
                owner, background, policy, "早安", policy.getSourceUrl(),
                "artworks/test/concurrent.png"));
        var principal = new CurrentUser(
                liker.getId(), liker.getSsoSubject(), liker.getAccount(), liker.getDisplayName());
        var start = new CountDownLatch(1);

        try (var executor = Executors.newFixedThreadPool(2)) {
            var first = executor.submit(() -> {
                start.await();
                return artworkLikeService.like(principal, artwork.getId());
            });
            var second = executor.submit(() -> {
                start.await();
                return artworkLikeService.like(principal, artwork.getId());
            });
            start.countDown();

            assertThat(List.of(
                            first.get(10, TimeUnit.SECONDS).likeCount(),
                            second.get(10, TimeUnit.SECONDS).likeCount()))
                    .containsOnly(1L);
            assertThat(artworks.findLikeCountById(artwork.getId())).isEqualTo(1L);
        } finally {
            artworkLikes.deleteAll();
            artworks.deleteById(artwork.getId());
            users.deleteAllById(List.of(owner.getId(), liker.getId()));
            backgrounds.deleteById(background.getId());
            policies.deleteById(policy.getId());
        }
    }

    private ArtworkFixtures createArtworkFixtures() {
        var owner = users.saveAndFlush(new User("owner-subject", "owner-account", "Owner"));
        var background = backgrounds.saveAndFlush(
                new Background("晨曦", "backgrounds/sunrise.png", 0, true));
        var policy = policies.saveAndFlush(new Policy(
                "福利", "敬老卡", "日日好行", "https://example.gov.tw/policy",
                LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31), true));
        return new ArtworkFixtures(owner, background, policy);
    }

    private record ArtworkFixtures(User owner, Background background, Policy policy) {
    }
}
