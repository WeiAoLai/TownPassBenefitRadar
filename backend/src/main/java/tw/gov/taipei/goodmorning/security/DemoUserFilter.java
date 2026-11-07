package tw.gov.taipei.goodmorning.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;
import tw.gov.taipei.goodmorning.config.DemoUserProperties;
import tw.gov.taipei.goodmorning.exception.ProblemResponseWriter;
import tw.gov.taipei.goodmorning.observability.TraceContext;
import tw.gov.taipei.goodmorning.service.CurrentUserService;

@Component
@Profile("demo")
public class DemoUserFilter extends OncePerRequestFilter {

    static final String HEADER_NAME = "X-Demo-User";

    private final DemoUserProperties properties;
    private final CurrentUserService currentUserService;
    private final ProblemResponseWriter problemWriter;

    public DemoUserFilter(
            DemoUserProperties properties,
            CurrentUserService currentUserService,
            ProblemResponseWriter problemWriter) {
        this.properties = properties;
        this.currentUserService = currentUserService;
        this.problemWriter = problemWriter;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        var alias = request.getHeader(HEADER_NAME);
        if (!StringUtils.hasText(alias)) {
            problemWriter.write(
                    request, response, HttpStatus.UNAUTHORIZED, "AUTH_REQUIRED",
                    "X-Demo-User header is required");
            return;
        }

        var demoUser = properties.demoUsers().get(alias);
        if (demoUser == null) {
            problemWriter.write(
                    request, response, HttpStatus.UNAUTHORIZED, "AUTH_INVALID",
                    "X-Demo-User is not allowed");
            return;
        }

        var principal = currentUserService.resolveDemoUser(demoUser);
        request.setAttribute(TraceContext.USER_ID_ATTRIBUTE, principal.id());
        var authentication = UsernamePasswordAuthenticationToken.authenticated(
                principal, alias, List.of());
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        var path = request.getRequestURI().substring(request.getContextPath().length());
        return path.startsWith("/actuator/")
                || path.startsWith("/openapi")
                || path.startsWith("/swagger-ui");
    }
}
