package tw.gov.taipei.goodmorning;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.yaml.snakeyaml.Yaml;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Testcontainers
class OpenApiContractTest {

    private static final Set<String> HTTP_METHODS =
            Set.of("get", "post", "put", "patch", "delete");

    @Container
    private static final MariaDBContainer<?> MARIADB =
            new MariaDBContainer<>("mariadb:11.4")
                    .withDatabaseName("good_morning_openapi_test")
                    .withUsername("good_morning")
                    .withPassword("good_morning");

    @DynamicPropertySource
    static void databaseProperties(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", MARIADB::getJdbcUrl);
        registry.add("spring.datasource.username", MARIADB::getUsername);
        registry.add("spring.datasource.password", MARIADB::getPassword);
    }

    @Autowired
    private MockMvc mockMvc;

    @Test
    void generatedContractMatchesCheckedInPathsOperationsAndCoreFields() throws Exception {
        var response = mockMvc.perform(get("/api/openapi")
                        .contextPath("/api")
                        .servletPath("/openapi"))
                .andExpect(status().isOk())
                .andReturn()
                .getResponse()
                .getContentAsByteArray();
        var generated = new ObjectMapper().readTree(response);
        Map<String, Object> checkedIn;
        try (var input = Files.newInputStream(Path.of("openapi.yaml"))) {
            checkedIn = new Yaml().load(input);
        }

        assertOperationsMatch(checkedIn, generated);
        assertCoreFieldsMatch(checkedIn, generated);
    }

    @SuppressWarnings("unchecked")
    private void assertOperationsMatch(Map<String, Object> checkedIn, JsonNode generated) {
        var paths = (Map<String, Map<String, Object>>) checkedIn.get("paths");
        paths.forEach((path, pathItem) -> pathItem.forEach((method, operationValue) -> {
            if (!HTTP_METHODS.contains(method)) {
                return;
            }
            var operation = (Map<String, Object>) operationValue;
            assertThat(generated.path("paths").path(path).path(method).isMissingNode())
                    .as("generated operation %s %s", method.toUpperCase(), path)
                    .isFalse();
            assertThat(generated.path("paths").path(path).path(method).path("operationId").asText())
                    .isEqualTo(operation.get("operationId"));
        }));
    }

    @SuppressWarnings("unchecked")
    private void assertCoreFieldsMatch(Map<String, Object> checkedIn, JsonNode generated) {
        var checkedSchemas = (Map<String, Map<String, Object>>)
                ((Map<String, Object>) checkedIn.get("components")).get("schemas");
        var schemaNames = Map.of(
                "CurrentUser", "CurrentUserResponse",
                "Background", "BackgroundResponse",
                "Policy", "PolicyResponse",
                "Badge", "BadgeResponse",
                "AuthorSummary", "AuthorSummaryResponse",
                "Artwork", "ArtworkResponse",
                "ArtworkPage", "ArtworkPageResponse",
                "LikeState", "LikeStateResponse",
                "LeaderboardEntry", "LeaderboardEntryResponse");

        schemaNames.forEach((checkedName, generatedName) -> {
            var checkedProperties = ((Map<String, Object>)
                    checkedSchemas.get(checkedName).get("properties")).keySet();
            var generatedProperties = generated.path("components")
                    .path("schemas")
                    .path(generatedName)
                    .path("properties");
            assertThat(generatedProperties.isMissingNode())
                    .as("generated schema %s", generatedName)
                    .isFalse();
            assertThat(generatedProperties.propertyStream().map(Map.Entry::getKey).toList())
                    .containsAll(checkedProperties);
        });
    }
}
