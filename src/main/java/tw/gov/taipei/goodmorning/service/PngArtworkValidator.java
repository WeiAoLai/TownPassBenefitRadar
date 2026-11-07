package tw.gov.taipei.goodmorning.service;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import javax.imageio.ImageIO;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import tw.gov.taipei.goodmorning.exception.ApiException;

@Component
public class PngArtworkValidator {

    public static final int REQUIRED_WIDTH = 1080;
    public static final int REQUIRED_HEIGHT = 1080;
    public static final int MAX_BYTES = 10 * 1024 * 1024;
    private static final byte[] PNG_SIGNATURE = {
        (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
    };

    public void validate(byte[] content) {
        if (content == null || content.length == 0) {
            throw invalid("Artwork image is required");
        }
        if (content.length > MAX_BYTES) {
            throw new ApiException(
                    HttpStatus.PAYLOAD_TOO_LARGE,
                    "ARTWORK_IMAGE_TOO_LARGE",
                    "Artwork image must not exceed 10 MB");
        }
        if (content.length < PNG_SIGNATURE.length
                || !Arrays.equals(
                        PNG_SIGNATURE,
                        Arrays.copyOfRange(content, 0, PNG_SIGNATURE.length))) {
            throw invalid("Artwork image must be a PNG");
        }

        try (var input = new ByteArrayInputStream(content)) {
            var image = ImageIO.read(input);
            if (image == null) {
                throw invalid("Artwork image contains invalid PNG data");
            }
            if (image.getWidth() != REQUIRED_WIDTH || image.getHeight() != REQUIRED_HEIGHT) {
                throw new ApiException(
                        HttpStatus.BAD_REQUEST,
                        "ARTWORK_IMAGE_DIMENSIONS_INVALID",
                        "Artwork image must be exactly 1080 x 1080 pixels");
            }
        } catch (IOException exception) {
            throw invalid("Artwork image contains invalid PNG data");
        }
    }

    private ApiException invalid(String detail) {
        return new ApiException(HttpStatus.BAD_REQUEST, "ARTWORK_IMAGE_INVALID", detail);
    }
}
