package tw.gov.taipei.goodmorning.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import tw.gov.taipei.goodmorning.exception.ProblemResponseWriter;
import tw.gov.taipei.goodmorning.security.DemoUserFilter;

@Configuration
@Profile("demo")
@EnableConfigurationProperties(DemoUserProperties.class)
public class SecurityConfiguration {

    @Bean
    SecurityFilterChain demoSecurityFilterChain(
            HttpSecurity http, DemoUserFilter demoUserFilter, ProblemResponseWriter problemWriter)
            throws Exception {
        http.csrf(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .formLogin(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(authorize -> authorize
                        .requestMatchers(
                                "/actuator/health",
                                "/actuator/prometheus",
                                "/openapi/**",
                                "/swagger-ui/**",
                                "/swagger-ui.html")
                        .permitAll()
                        .anyRequest()
                        .authenticated())
                .exceptionHandling(exceptions -> exceptions.authenticationEntryPoint(
                        (request, response, exception) -> problemWriter.write(
                                request,
                                response,
                                HttpStatus.UNAUTHORIZED,
                                "AUTH_REQUIRED",
                                "Authentication is required")))
                .addFilterBefore(demoUserFilter, UsernamePasswordAuthenticationFilter.class);
        return http.build();
    }
}
