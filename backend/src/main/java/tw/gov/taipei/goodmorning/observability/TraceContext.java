package tw.gov.taipei.goodmorning.observability;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import java.util.regex.Pattern;

public final class TraceContext {

    public static final String TRACE_ID_HEADER = "X-Request-ID";
    public static final String TRACE_ID_ATTRIBUTE = "goodMorningTraceId";
    public static final String USER_ID_ATTRIBUTE = "goodMorningUserId";
    public static final String MDC_KEY = "traceId";

    private static final Pattern SAFE_TRACE_ID = Pattern.compile("[A-Za-z0-9._-]{1,128}");

    private TraceContext() {
    }

    public static String getOrCreate(HttpServletRequest request) {
        var existing = request.getAttribute(TRACE_ID_ATTRIBUTE);
        if (existing != null) {
            return existing.toString();
        }

        var supplied = request.getHeader(TRACE_ID_HEADER);
        var traceId = supplied != null && SAFE_TRACE_ID.matcher(supplied).matches()
                ? supplied
                : UUID.randomUUID().toString();
        request.setAttribute(TRACE_ID_ATTRIBUTE, traceId);
        return traceId;
    }
}
