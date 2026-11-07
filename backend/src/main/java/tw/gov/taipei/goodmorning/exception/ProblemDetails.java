package tw.gov.taipei.goodmorning.exception;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.stereotype.Component;
import tw.gov.taipei.goodmorning.observability.TraceContext;

@Component
public class ProblemDetails {

    public ProblemDetail create(
            HttpServletRequest request, HttpStatus status, String code, String detail) {
        var problem = ProblemDetail.forStatusAndDetail(status, detail);
        problem.setTitle(status.getReasonPhrase());
        problem.setInstance(URI.create(request.getRequestURI()));
        problem.setProperty("code", code);
        problem.setProperty("traceId", TraceContext.getOrCreate(request));
        return problem;
    }
}
