package tw.gov.taipei.goodmorning.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.concurrent.TimeUnit;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger LOGGER = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(
            HttpServletRequest request,
            HttpServletResponse response,
            FilterChain filterChain) throws ServletException, IOException {
        var traceId = TraceContext.getOrCreate(request);
        response.setHeader(TraceContext.TRACE_ID_HEADER, traceId);
        var startedAt = System.nanoTime();

        try (var ignored = MDC.putCloseable(TraceContext.MDC_KEY, traceId)) {
            try {
                filterChain.doFilter(request, response);
            } finally {
                logRequest(request, response, startedAt);
            }
        }
    }

    private void logRequest(
            HttpServletRequest request,
            HttpServletResponse response,
            long startedAt) {
        var durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
        var userId = request.getAttribute(TraceContext.USER_ID_ATTRIBUTE);
        var message = "http_request method={} path={} status={} durationMs={} userId={}";
        var resolvedUserId = userId == null ? "-" : userId;

        if (response.getStatus() >= 500) {
            LOGGER.error(
                    message,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMs,
                    resolvedUserId);
        } else if (response.getStatus() >= 400) {
            LOGGER.warn(
                    message,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMs,
                    resolvedUserId);
        } else {
            LOGGER.info(
                    message,
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    durationMs,
                    resolvedUserId);
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        var path = request.getRequestURI().substring(request.getContextPath().length());
        return path.startsWith("/actuator/health") || path.equals("/actuator/prometheus");
    }
}
