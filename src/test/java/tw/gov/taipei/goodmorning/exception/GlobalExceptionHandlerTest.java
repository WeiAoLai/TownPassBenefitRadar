package tw.gov.taipei.goodmorning.exception;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

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

    @Test
    void oversizedMultipartRequestsReturnPayloadTooLarge() {
        var request = new MockHttpServletRequest("POST", "/api/artworks");

        var response = handler.handleUploadTooLarge(
                new MaxUploadSizeExceededException(10 * 1024 * 1024), request);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONTENT_TOO_LARGE);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getProperties())
                .containsEntry("code", "ARTWORK_IMAGE_TOO_LARGE");
    }
}
