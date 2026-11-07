package tw.gov.taipei.goodmorning.exception;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

class GlobalExceptionHandlerTest {

    private final GlobalExceptionHandler handler =
            new GlobalExceptionHandler(new ProblemDetails());

    @Test
    void unexpectedErrorsUseTheStableProblemContract() {
        var request = new MockHttpServletRequest("GET", "/api/failure");
        var logger = (Logger) LoggerFactory.getLogger(GlobalExceptionHandler.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        var failure = new RuntimeException("sensitive");

        var response = handler.handleUnexpected(failure, request);

        try {
            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().getProperties())
                    .containsEntry("code", "INTERNAL_ERROR")
                    .containsKey("traceId");
            assertThat(response.getBody().getDetail()).doesNotContain("sensitive");
            assertThat(appender.list)
                    .singleElement()
                    .satisfies(event -> {
                        assertThat(event.getLevel()).isEqualTo(Level.ERROR);
                        assertThat(event.getFormattedMessage())
                                .contains("unhandled_exception")
                                .contains("path=/api/failure");
                        assertThat(event.getThrowableProxy().getClassName())
                                .isEqualTo(RuntimeException.class.getName());
                    });
        } finally {
            logger.detachAppender(appender);
            appender.stop();
        }
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
