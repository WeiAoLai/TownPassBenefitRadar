package tw.gov.taipei.goodmorning.config;

import java.util.Map;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public record DemoUserProperties(Map<String, DemoUser> demoUsers) {

    public DemoUserProperties {
        demoUsers = demoUsers == null ? Map.of() : Map.copyOf(demoUsers);
    }

    public record DemoUser(String ssoSubject, String account, String displayName) {
    }
}
