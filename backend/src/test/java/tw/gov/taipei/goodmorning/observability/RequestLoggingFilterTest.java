package tw.gov.taipei.goodmorning.observability;

import static org.assertj.core.api.Assertions.assertThat;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RequestLoggingFilterTest {

    @Test
    void propagatesAValidRequestIdThroughMdcResponseAndAccessLog() throws Exception {
        var logger = (Logger) LoggerFactory.getLogger(RequestLoggingFilter.class);
        var appender = new ListAppender<ILoggingEvent>();
        appender.start();
        logger.addAppender(appender);
        var request = new MockHttpServletRequest("GET", "/api/v1/artworks");
        request.addHeader(TraceContext.TRACE_ID_HEADER, "frontend-request-123");
        var response = new MockHttpServletResponse();
        var filter = new RequestLoggingFilter();

        try {
            filter.doFilter(request, response, (servletRequest, servletResponse) -> {
                assertThat(MDC.get(TraceContext.MDC_KEY)).isEqualTo("frontend-request-123");
                servletRequest.setAttribute(TraceContext.USER_ID_ATTRIBUTE, 7L);
                ((MockHttpServletResponse) servletResponse).setStatus(200);
            });

            assertThat(response.getHeader(TraceContext.TRACE_ID_HEADER))
                    .isEqualTo("frontend-request-123");
            assertThat(request.getAttribute(TraceContext.TRACE_ID_ATTRIBUTE))
                    .isEqualTo("frontend-request-123");
            assertThat(MDC.get(TraceContext.MDC_KEY)).isNull();
            assertThat(appender.list)
                    .singleElement()
                    .satisfies(event -> {
                        assertThat(event.getFormattedMessage())
                                .contains("http_request")
                                .contains("method=GET")
                                .contains("path=/api/v1/artworks")
                                .contains("status=200")
                                .contains("userId=7");
                        assertThat(event.getMDCPropertyMap())
                                .containsEntry(TraceContext.MDC_KEY, "frontend-request-123");
                    });
        } finally {
            logger.detachAppender(appender);
            appender.stop();
            MDC.clear();
        }
    }

    @Test
    void replacesAnUnsafeRequestId() throws Exception {
        var request = new MockHttpServletRequest("GET", "/api/v1/me");
        request.addHeader(TraceContext.TRACE_ID_HEADER, "contains spaces and should be rejected");
        var response = new MockHttpServletResponse();

        new RequestLoggingFilter().doFilter(request, response, (ignoredRequest, ignoredResponse) -> {
        });

        assertThat(response.getHeader(TraceContext.TRACE_ID_HEADER))
                .matches("[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}");
    }
}
