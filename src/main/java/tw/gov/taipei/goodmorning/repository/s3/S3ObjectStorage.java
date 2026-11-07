package tw.gov.taipei.goodmorning.repository.s3;

import java.net.URI;
import org.springframework.stereotype.Repository;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import tw.gov.taipei.goodmorning.config.S3Properties;
import tw.gov.taipei.goodmorning.service.ObjectStorage;

@Repository
public class S3ObjectStorage implements ObjectStorage {

    private final S3Client client;
    private final S3Presigner presigner;
    private final S3Properties properties;

    public S3ObjectStorage(
            S3Client client, S3Presigner presigner, S3Properties properties) {
        this.client = client;
        this.presigner = presigner;
        this.properties = properties;
    }

    @Override
    public void put(String objectKey, byte[] content, String contentType) {
        var request = PutObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .contentType(contentType)
                .contentLength((long) content.length)
                .build();
        client.putObject(request, RequestBody.fromBytes(content));
    }

    @Override
    public byte[] get(String objectKey) {
        var request = GetObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .build();
        return client.getObjectAsBytes(request).asByteArray();
    }

    @Override
    public void delete(String objectKey) {
        var request = DeleteObjectRequest.builder()
                .bucket(properties.bucket())
                .key(objectKey)
                .build();
        client.deleteObject(request);
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
