package tw.gov.taipei.goodmorning.repository.s3;

import java.net.URI;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import tw.gov.taipei.goodmorning.config.S3Properties;
import tw.gov.taipei.goodmorning.service.ObjectStorage;

@Repository
public class S3ObjectStorage implements ObjectStorage {

    private final S3Presigner presigner;
    private final S3Properties properties;

    public S3ObjectStorage(S3Presigner presigner, S3Properties properties) {
        this.presigner = presigner;
        this.properties = properties;
    }

    @Override
    public URI readUrl(String objectKey) {
        var getRequest = GetObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .build();
        var presignRequest = GetObjectPresignRequest.builder()
                .signatureDuration(properties.presignedUrlTtl())
                .getObjectRequest(getRequest)
                .build();
        return URI.create(presigner.presignGetObject(presignRequest).url().toString());
    }
}
