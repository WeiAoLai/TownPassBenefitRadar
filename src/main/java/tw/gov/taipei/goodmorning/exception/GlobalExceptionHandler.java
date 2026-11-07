package tw.gov.taipei.goodmorning.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private final ProblemDetails problemDetails;

    public GlobalExceptionHandler(ProblemDetails problemDetails) {
        this.problemDetails = problemDetails;
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ProblemDetail> handleApiException(
            ApiException exception, HttpServletRequest request) {
        return response(
                request,
                exception.status(),
                exception.code(),
                exception.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ResponseEntity<ProblemDetail> handleValidation(
            MethodArgumentNotValidException exception, HttpServletRequest request) {
        return response(request, HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Request validation failed");
    }

    @ExceptionHandler({
        MissingServletRequestParameterException.class,
        HttpMessageNotReadableException.class,
        ConstraintViolationException.class
    })
    ResponseEntity<ProblemDetail> handleInvalidRequest(Exception exception, HttpServletRequest request) {
        return response(request, HttpStatus.BAD_REQUEST, "REQUEST_INVALID", "Request is invalid");
    }

    @ExceptionHandler(ResponseStatusException.class)
    ResponseEntity<ProblemDetail> handleResponseStatus(
            ResponseStatusException exception, HttpServletRequest request) {
        var status = HttpStatus.valueOf(exception.getStatusCode().value());
        var code = status == HttpStatus.NOT_FOUND ? "RESOURCE_NOT_FOUND" : "REQUEST_REJECTED";
        return response(request, status, code, exception.getReason());
    }

    @ExceptionHandler(Exception.class)
    ResponseEntity<ProblemDetail> handleUnexpected(Exception exception, HttpServletRequest request) {
        return response(
                request,
                HttpStatus.INTERNAL_SERVER_ERROR,
                "INTERNAL_ERROR",
                "An unexpected error occurred");
    }

    private ResponseEntity<ProblemDetail> response(
            HttpServletRequest request, HttpStatus status, String code, String detail) {
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_PROBLEM_JSON)
                .body(problemDetails.create(request, status, code, detail));
    }
}
