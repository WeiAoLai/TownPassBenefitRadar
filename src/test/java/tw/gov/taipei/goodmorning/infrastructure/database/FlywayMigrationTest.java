package tw.gov.taipei.goodmorning.infrastructure.database;

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

        assertThat(columns).containsExactly("start_date:date:NO", "end_date:date:NO");
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
