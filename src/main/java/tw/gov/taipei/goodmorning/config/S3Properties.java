package tw.gov.taipei.goodmorning.config;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.s3")
public record S3Properties(
        String bucket, String region, String endpoint, Duration presignedUrlTtl) {
}
