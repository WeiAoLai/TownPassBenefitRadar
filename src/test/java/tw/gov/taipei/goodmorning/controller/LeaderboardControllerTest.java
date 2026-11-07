package tw.gov.taipei.goodmorning.controller;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.dto.AuthorSummaryResponse;
import tw.gov.taipei.goodmorning.dto.LeaderboardEntryResponse;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.LeaderboardService;

class LeaderboardControllerTest {

    private static final CurrentUser PRINCIPAL =
            new CurrentUser(7L, "demo-user-a", "user-a", "小明");

    @Test
    void returnsLeaderboardEntries() throws Exception {
        var service = mock(LeaderboardService.class);
        var artwork = new ArtworkResponse(
                42L,
                new AuthorSummaryResponse(8L, "作者", null),
                1L,
                2L,
                "早安台北",
                "https://assets.example/42.png",
                9,
                5,
                true,
                false,
                Instant.parse("2026-11-07T04:00:00Z"));
        when(service.get(PRINCIPAL))
                .thenReturn(List.of(new LeaderboardEntryResponse(2, 9, artwork)));
        var mockMvc = MockMvcBuilders.standaloneSetup(new LeaderboardController(service))
                .setCustomArgumentResolvers(new CurrentUserArgumentResolver())
                .build();

        mockMvc.perform(get("/api/leaderboard").contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].rank").value(2))
                .andExpect(jsonPath("$[0].score").value(9))
                .andExpect(jsonPath("$[0].artwork.id").value(42));

        verify(service).get(PRINCIPAL);
    }

    private static class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

        @Override
        public boolean supportsParameter(MethodParameter parameter) {
            return parameter.getParameterType() == CurrentUser.class
                    && parameter.hasParameterAnnotation(AuthenticationPrincipal.class);
        }

        @Override
        public Object resolveArgument(
                MethodParameter parameter,
                ModelAndViewContainer mavContainer,
                NativeWebRequest webRequest,
                WebDataBinderFactory binderFactory) {
            return PRINCIPAL;
        }
    }
}
