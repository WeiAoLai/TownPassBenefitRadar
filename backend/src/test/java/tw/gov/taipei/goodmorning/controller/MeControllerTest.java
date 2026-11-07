package tw.gov.taipei.goodmorning.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.testcontainers.containers.MariaDBContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import tw.gov.taipei.goodmorning.observability.TraceContext;
import tw.gov.taipei.goodmorning.repository.UserRepository;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("demo")
@Testcontainers
class MeControllerTest {

    @Container
    private static final MariaDBContainer<?> MARIADB =
            new MariaDBContainer<>("mariadb:11.4")
                    .withDatabaseName("good_morning_controller_test")
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

    @Autowired
    private UserRepository users;

    @BeforeEach
    void deleteUsers() {
        users.deleteAll();
    }

    @Test
    void missingDemoUserHeaderReturnsProblemDetail() throws Exception {
        mockMvc.perform(get("/api/me").contextPath("/api"))
                .andExpect(status().isUnauthorized())
                .andExpect(header().exists(TraceContext.TRACE_ID_HEADER))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("AUTH_REQUIRED"))
                .andExpect(jsonPath("$.traceId").isNotEmpty());
    }

    @Test
    void prometheusMetricsAreAvailableWithoutDemoAuthentication() throws Exception {
        mockMvc.perform(get("/api/actuator/prometheus").contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("application=\"good-morning\"")));
    }

    @Test
    void unknownDemoAliasReturnsProblemDetail() throws Exception {
        mockMvc.perform(get("/api/me")
                        .contextPath("/api")
                        .header("X-Demo-User", "not-allowed"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON))
                .andExpect(jsonPath("$.code").value("AUTH_INVALID"));
    }

    @Test
    void validAliasCreatesAndReturnsTheCurrentUser() throws Exception {
        mockMvc.perform(get("/api/me")
                        .contextPath("/api")
                        .header("X-Demo-User", "user-a"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.account").value("user-a"))
                .andExpect(jsonPath("$.displayName").value("小明"))
                .andExpect(jsonPath("$.artworkCount").value(0))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());

        assertThat(users.findBySsoSubject("demo-user-a"))
                .hasValueSatisfying(user -> {
                    assertThat(user.getAccount()).isEqualTo("user-a");
                    assertThat(user.getDisplayName()).isEqualTo("小明");
                });
    }

    @Test
    void clientOwnerIdCannotChangeTheAuthenticatedUser() throws Exception {
        mockMvc.perform(get("/api/me")
                        .contextPath("/api")
                        .queryParam("ownerId", "999999")
                        .header("X-Demo-User", "user-b"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.account").value("user-b"))
                .andExpect(jsonPath("$.displayName").value("小華"));
    }
}
