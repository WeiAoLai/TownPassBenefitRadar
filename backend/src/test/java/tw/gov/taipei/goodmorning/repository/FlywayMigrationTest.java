package tw.gov.taipei.goodmorning.repository;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import org.flywaydb.core.Flyway;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@Testcontainers
class FlywayMigrationTest {

    @Container
    private static final MariaDBContainer<?> MARIADB =
            new MariaDBContainer<>("mariadb:11.4")
                    .withDatabaseName("good_morning_test")
                    .withUsername("good_morning")
                    .withPassword("good_morning");

    @BeforeAll
    static void migrate() {
        Flyway.configure()
                .dataSource(MARIADB.getJdbcUrl(), MARIADB.getUsername(), MARIADB.getPassword())
                .load()
                .migrate();
    }

    @Test
    void createsTheExpectedBusinessTables() throws SQLException {
        var tableNames = queryStrings("""
                SELECT table_name
                  FROM information_schema.tables
                 WHERE table_schema = DATABASE()
                   AND table_name <> 'flyway_schema_history'
                 ORDER BY table_name
                """);

        assertThat(tableNames).containsExactlyInAnyOrder(
                "users", "backgrounds", "policies", "artworks", "artwork_likes");
    }

    @Test
    void createsRequiredPolicyDateColumns() throws SQLException {
        var columns = queryStrings("""
                SELECT CONCAT(column_name, ':', data_type, ':', is_nullable)
                  FROM information_schema.columns
                 WHERE table_schema = DATABASE()
                   AND table_name = 'policies'
                   AND column_name IN ('start_date', 'end_date')
                 ORDER BY ordinal_position
                """);

        assertThat(columns).containsExactly("start_date:date:YES", "end_date:date:YES");
    }

    @Test
    void createsTheDeliveredPolicyColumnShapes() throws SQLException {
        var columns = queryStrings("""
                SELECT CONCAT(
                    column_name, ':', column_type, ':', is_nullable,
                    ':', COALESCE(column_default, 'NULL'))
                  FROM information_schema.columns
                 WHERE table_schema = DATABASE()
                   AND table_name = 'policies'
                   AND column_name IN (
                       'id', 'category', 'title', 'slogan', 'source_url',
                       'is_active', 'start_date', 'end_date')
                 ORDER BY ordinal_position
                """);

        assertThat(columns).containsExactly(
                "id:int(10) unsigned:NO:NULL",
                "category:varchar(50):NO:NULL",
                "title:varchar(255):NO:NULL",
                "slogan:varchar(255):NO:NULL",
                "source_url:varchar(768):NO:NULL",
                "start_date:date:YES:NULL",
                "end_date:date:YES:NULL",
                "is_active:tinyint(1):NO:1");
    }

    @Test
    void makesPolicySourceUrlsUnique() throws SQLException {
        var uniqueIndexColumns = queryStrings("""
                SELECT column_name
                  FROM information_schema.statistics
                 WHERE table_schema = DATABASE()
                   AND table_name = 'policies'
                   AND index_name = 'uk_policies_source_url'
                   AND non_unique = 0
                 ORDER BY seq_in_index
                """);

        assertThat(uniqueIndexColumns).containsExactly("source_url");
    }

    @Test
    void preventsDuplicateLikesFromTheSameUser() throws SQLException {
        var uniqueIndexColumns = queryStrings("""
                SELECT column_name
                  FROM information_schema.statistics
                 WHERE table_schema = DATABASE()
                   AND table_name = 'artwork_likes'
                   AND index_name = 'uk_artwork_likes_user_artwork'
                   AND non_unique = 0
                 ORDER BY seq_in_index
                """);

        assertThat(uniqueIndexColumns).containsExactly("user_id", "artwork_id");
    }

    @Test
    void seedsTheTenDeliveredPolicies() throws SQLException {
        var titles = queryStrings("""
                SELECT title
                  FROM policies
                 ORDER BY id
                """);

        assertThat(titles).containsExactly(
                "115年地價稅開徵",
                "115年度300億元中央擴大租金補貼",
                "臺北市低收入戶生活補助",
                "臺北市中低收入戶健保費補助",
                "臺北市生育補助",
                "臺北市友善托育補助",
                "不孕症試管嬰兒補助3.0",
                "臺北市敬老卡每月600點補助",
                "臺北市中低收入老人生活津貼",
                "臺北市中低收入老人特別照顧津貼");
    }

    @Test
    void seedsTheDeliveredPolicyCategoriesAndEditorSlogans() throws SQLException {
        var categoryCounts = queryStrings("""
                SELECT CONCAT(category, ':', COUNT(*))
                  FROM policies
                 GROUP BY category
                 ORDER BY category
                """);
        var slogans = queryStrings("""
                SELECT slogan
                  FROM policies
                 ORDER BY id
                """);
        var slogansOverTwentyCharacters = queryStrings("""
                SELECT COUNT(*)
                  FROM policies
                 WHERE CHAR_LENGTH(slogan) > 20
                """);

        assertThat(categoryCounts).containsExactly("民生費用:4", "生育:3", "老人:3");
        assertThat(slogans).containsExactly(
                "地價稅11/30前繳，安心不忘記！",
                "租屋補貼12/31截止，記得申請！",
                "生活扶助有依靠，符合資格來申請！",
                "健保費有補助，符合資格別錯過！",
                "迎接新生命，生育獎勵依胎次申請！",
                "未滿3歲托育有補助，育兒更安心！",
                "試管療程有補助，好孕路上有支持！",
                "敬老卡每月600點，出門更便利！",
                "長者生活有津貼，符合資格來申請！",
                "合格照顧者月補5,000元，暖心相伴！");
        assertThat(slogansOverTwentyCharacters).containsExactly("0");
    }

    @Test
    void keepsPoliciesWithoutAnEndDateAsNull() throws SQLException {
        var openEndedCount = queryStrings("""
                SELECT COUNT(*)
                  FROM policies
                 WHERE end_date IS NULL
                """);
        var availableOnBaselineDate = queryStrings("""
                SELECT COUNT(*)
                  FROM policies
                 WHERE is_active = TRUE
                   AND (start_date IS NULL OR start_date <= '2026-11-07')
                   AND (end_date IS NULL OR end_date >= '2026-11-07')
                """);

        assertThat(openEndedCount).containsExactly("8");
        assertThat(availableOnBaselineDate).containsExactly("10");
    }

    @Test
    void seedsTheDeliveredBackgroundAsset() throws SQLException {
        var background = queryStrings("""
                SELECT CONCAT(name, ':', image_object_key, ':', unlock_threshold, ':', is_active)
                  FROM backgrounds
                 ORDER BY id
                """);

        assertThat(background).containsExactly(
                "台北晨曦:backgrounds/taipei-sunrise.png:0:1");
    }

    private static List<String> queryStrings(String sql) throws SQLException {
        try (Connection connection = DriverManager.getConnection(
                        MARIADB.getJdbcUrl(), MARIADB.getUsername(), MARIADB.getPassword());
                var statement = connection.createStatement();
                ResultSet resultSet = statement.executeQuery(sql)) {
            var values = new ArrayList<String>();
            while (resultSet.next()) {
                values.add(resultSet.getString(1));
            }
            return values;
        }
    }
}
