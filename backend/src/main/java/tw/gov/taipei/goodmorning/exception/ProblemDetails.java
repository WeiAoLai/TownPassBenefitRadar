package tw.gov.taipei.goodmorning.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;

@Component
public class ProblemDetails {

    public static final String TRACE_ID_ATTRIBUTE = "goodMorningTraceId";

    public ProblemDetail create(
            HttpServletRequest request, HttpStatus status, String code, String detail) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        problem.setProperty("traceId", traceId(request));
        return problem;
    }

    private String traceId(HttpServletRequest request) {
        var existing = request.getAttribute(TRACE_ID_ATTRIBUTE);
        if (existing != null) {
            return existing.toString();
        }

        var traceId = UUID.randomUUID().toString();
        request.setAttribute(TRACE_ID_ATTRIBUTE, traceId);
        return traceId;
    }
}
