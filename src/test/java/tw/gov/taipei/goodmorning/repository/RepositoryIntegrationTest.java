package tw.gov.taipei.goodmorning.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.ArrayList;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.transaction.annotation.Transactional;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tw.gov.taipei.goodmorning.entity.Artwork;
import tw.gov.taipei.goodmorning.entity.ArtworkLike;
import tw.gov.taipei.goodmorning.entity.Background;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.entity.User;

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
        policies.save(new Policy(
                "福利", "尚未開始", "敬請期待", "https://example.gov.tw/future",
                today.plusDays(1), today.plusDays(2), true));
        policies.save(new Policy(
                "福利", "已結束", "活動結束", "https://example.gov.tw/expired",
                today.minusDays(2), today.minusDays(1), true));
        policies.save(new Policy(
                "福利", "未啟用", "尚未啟用", "https://example.gov.tw/inactive",
                today.minusDays(1), today.plusDays(1), false));
        policies.flush();

        assertThat(policies.findAvailableOn(today))
                .extracting(Policy::getId)
                .containsExactly(available.getId());
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
    }

    @Test
    void userCanLikeAnArtworkOnlyOnce() {
        var fixtures = createArtworkFixtures();
        var artwork = artworks.saveAndFlush(new Artwork(
                fixtures.owner(), fixtures.background(), fixtures.policy(),
                "早安台北", fixtures.policy().getSourceUrl(), "artworks/test/liked.png"));
        artworkLikes.saveAndFlush(new ArtworkLike(fixtures.owner(), artwork));

        assertThatThrownBy(() ->
                        artworkLikes.saveAndFlush(new ArtworkLike(fixtures.owner(), artwork)))
                .isInstanceOf(DataIntegrityViolationException.class);
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
