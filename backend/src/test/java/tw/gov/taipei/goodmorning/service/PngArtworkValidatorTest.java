package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import tw.gov.taipei.goodmorning.exception.ApiException;

class PngArtworkValidatorTest {

    private final PngArtworkValidator validator = new PngArtworkValidator();

    @Test
    void acceptsA1080SquarePng() throws IOException {
        assertThatCode(() -> validator.validate(png(1080, 1080))).doesNotThrowAnyException();
    }

    @Test
    void rejectsFilesOverTenMegabytes() {
        assertThatThrownBy(() -> validator.validate(new byte[10 * 1024 * 1024 + 1]))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    org.assertj.core.api.Assertions.assertThat(exception.code())
                            .isEqualTo("ARTWORK_IMAGE_TOO_LARGE");
                });
    }

    @Test
    void rejectsAFileWithoutThePngSignature() {
        assertInvalidPng(new byte[] {1, 2, 3, 4});
    }

    @Test
    void rejectsInvalidImageDataEvenWithAPngSignature() {
        assertInvalidPng(new byte[] {
            (byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
        });
    }

    @Test
    void rejectsPngWithWrongDimensions() throws IOException {
        assertThatThrownBy(() -> validator.validate(png(100, 100)))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    org.assertj.core.api.Assertions.assertThat(exception.code())
                            .isEqualTo("ARTWORK_IMAGE_DIMENSIONS_INVALID");
                });
    }

    private void assertInvalidPng(byte[] bytes) {
        assertThatThrownBy(() -> validator.validate(bytes))
                .isInstanceOfSatisfying(ApiException.class, exception -> {
                    org.assertj.core.api.Assertions.assertThat(exception.code())
                            .isEqualTo("ARTWORK_IMAGE_INVALID");
                });
    }

    private byte[] png(int width, int height) throws IOException {
        var image = new BufferedImage(width, height, BufferedImage.TYPE_BYTE_BINARY);
        try (var output = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", output);
            return output.toByteArray();
        }
    }
}
