package tw.gov.taipei.goodmorning.controller;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;
import tw.gov.taipei.goodmorning.dto.ArtworkPageResponse;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.dto.AuthorSummaryResponse;
import tw.gov.taipei.goodmorning.dto.BadgeResponse;
import tw.gov.taipei.goodmorning.exception.GlobalExceptionHandler;
import tw.gov.taipei.goodmorning.exception.ProblemDetails;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.ArtworkQueryService;
import tw.gov.taipei.goodmorning.service.CreateArtworkService;

class ArtworkControllerTest {

    private static final CurrentUser PRINCIPAL =
            new CurrentUser(7L, "demo-user-a", "user-a", "小明");
    private static final byte[] IMAGE = {1, 2, 3};

    private CreateArtworkService service;
    private ArtworkQueryService queries;
    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        service = mock(CreateArtworkService.class);
        queries = mock(ArtworkQueryService.class);
        mockMvc = MockMvcBuilders.standaloneSetup(new ArtworkController(service, queries))
                .setControllerAdvice(new GlobalExceptionHandler(new ProblemDetails()))
                .setCustomArgumentResolvers(new CurrentUserArgumentResolver())
                .build();
    }

    @Test
    void createsArtworkFromMultipartDataAndReturnsItsLocation() throws Exception {
        when(service.create(eq(PRINCIPAL), any(byte[].class), eq(1L), eq(2L), eq("早安台北")))
                .thenReturn(response());

        mockMvc.perform(multipart("/api/artworks")
                        .file(new MockMultipartFile(
                                "image", "artwork.png", "image/png", IMAGE))
                        .param("backgroundId", "1")
                        .param("policyId", "2")
                        .param("sloganText", "早安台北")
                        .contextPath("/api"))
                .andExpect(status().isCreated())
                .andExpect(header().string("Location", "/api/artworks/123"))
                .andExpect(jsonPath("$.id").value(123))
                .andExpect(jsonPath("$.owner.displayName").value("小明"))
                .andExpect(jsonPath("$.backgroundId").value(1))
                .andExpect(jsonPath("$.policyId").value(2))
                .andExpect(jsonPath("$.sloganText").value("早安台北"))
                .andExpect(jsonPath("$.imageUrl").value("https://assets.example/artwork.png"))
                .andExpect(jsonPath("$.ownedByMe").value(true));

        verify(service).create(PRINCIPAL, IMAGE, 1L, 2L, "早安台北");
    }

    @Test
    void missingImageReturnsBadRequestProblemDetails() throws Exception {
        mockMvc.perform(multipart("/api/artworks")
                        .param("backgroundId", "1")
                        .param("policyId", "2")
                        .param("sloganText", "早安台北")
                        .contextPath("/api"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("REQUEST_INVALID"));

        verifyNoInteractions(service);
    }

    @Test
    void listsPublicArtworksWithDefaultPaging() throws Exception {
        when(queries.listPublic(PRINCIPAL, 0, 20)).thenReturn(page());

        mockMvc.perform(get("/api/artworks").contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(123))
                .andExpect(jsonPath("$.page").value(0))
                .andExpect(jsonPath("$.size").value(20));

        verify(queries).listPublic(PRINCIPAL, 0, 20);
    }

    @Test
    void listsTheCurrentUsersArtworks() throws Exception {
        when(queries.listMine(PRINCIPAL, 2, 10)).thenReturn(page());

        mockMvc.perform(get("/api/me/artworks")
                        .contextPath("/api")
                        .queryParam("page", "2")
                        .queryParam("size", "10"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].ownedByMe").value(true));

        verify(queries).listMine(PRINCIPAL, 2, 10);
    }

    @Test
    void getsArtworkDetails() throws Exception {
        when(queries.get(PRINCIPAL, 123L)).thenReturn(response());

        mockMvc.perform(get("/api/artworks/123").contextPath("/api"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(123));

        verify(queries).get(PRINCIPAL, 123L);
    }

    private ArtworkResponse response() {
        return new ArtworkResponse(
                123L,
                new AuthorSummaryResponse(
                        7L,
                        "小明",
                        new BadgeResponse(1, "初心傳聲", "https://assets.example/badge.png")),
                1L,
                2L,
                "早安台北",
                "https://assets.example/artwork.png",
                0,
                0,
                false,
                true,
                Instant.parse("2026-11-07T04:00:00Z"));
    }

    private ArtworkPageResponse page() {
        return new ArtworkPageResponse(List.of(response()), 0, 20, 1, 1);
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
