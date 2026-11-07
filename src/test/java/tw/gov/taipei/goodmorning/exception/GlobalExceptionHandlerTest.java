package tw.gov.taipei.goodmorning.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler =
            new GlobalExceptionHandler(new ProblemDetails());

    @Test
    void unexpectedErrorsUseTheStableProblemContract() {
        var request = new MockHttpServletRequest("GET", "/api/failure");

        var response = handler.handleUnexpected(new RuntimeException("sensitive"), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getProperties())
                .containsEntry("code", "INTERNAL_ERROR")
                .containsKey("traceId");
        assertThat(response.getBody().getDetail()).doesNotContain("sensitive");
    }
}
