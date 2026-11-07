package tw.gov.taipei.goodmorning.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class ProblemResponseWriter {

    private final ObjectMapper objectMapper;
    private final ProblemDetails problemDetails;

    public ProblemResponseWriter(ObjectMapper objectMapper, ProblemDetails problemDetails) {
        this.objectMapper = objectMapper;
        this.problemDetails = problemDetails;
    }

    public void write(
            HttpServletRequest request,
            HttpServletResponse response,
            HttpStatus status,
            String code,
            String detail) throws IOException {
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        objectMapper.writeValue(
                response.getOutputStream(), problemDetails.create(request, status, code, detail));
    }
}
