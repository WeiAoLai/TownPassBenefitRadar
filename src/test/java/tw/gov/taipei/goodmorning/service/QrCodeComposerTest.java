package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.google.zxing.BinaryBitmap;
import com.google.zxing.MultiFormatReader;
import com.google.zxing.client.j2se.BufferedImageLuminanceSource;
import com.google.zxing.common.HybridBinarizer;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;

class QrCodeComposerTest {

    private final QrCodeComposer composer = new QrCodeComposer();

    @Test
    void generatedQrCodeDecodesToTheSnapshottedPolicyUrl() throws Exception {
        var policyUrl = "https://www.gov.taipei/policy/snapshot?id=42";

        var output = composer.compose(solidPng(Color.ORANGE), policyUrl);
        var image = ImageIO.read(new ByteArrayInputStream(output));
        var bitmap = new BinaryBitmap(new HybridBinarizer(new BufferedImageLuminanceSource(image)));

        assertThat(new MultiFormatReader().decode(bitmap).getText()).isEqualTo(policyUrl);
    }

    @Test
    void keepsThe1080SquareCanvasAndPlacesThePanelInTheBottomRight() throws Exception {
        var output = composer.compose(solidPng(Color.BLACK), "https://example.gov.tw/policy");
        var image = ImageIO.read(new ByteArrayInputStream(output));

        assertThat(image.getWidth()).isEqualTo(1080);
        assertThat(image.getHeight()).isEqualTo(1080);

        var changedPixels = 0;
        var minimumChangedX = image.getWidth();
        var minimumChangedY = image.getHeight();
        for (var y = 0; y < image.getHeight(); y++) {
            for (var x = 0; x < image.getWidth(); x++) {
                if ((image.getRGB(x, y) & 0x00ffffff) != 0) {
                    changedPixels++;
                    minimumChangedX = Math.min(minimumChangedX, x);
                    minimumChangedY = Math.min(minimumChangedY, y);
                }
            }
        }

        assertThat(changedPixels).isGreaterThan(1_000);
        assertThat(minimumChangedX).isGreaterThanOrEqualTo(800);
        assertThat(minimumChangedY).isGreaterThanOrEqualTo(800);
        assertThat(image.getRGB(100, 100) & 0x00ffffff).isZero();
    }

    private byte[] solidPng(Color color) throws Exception {
        var image = new BufferedImage(1080, 1080, BufferedImage.TYPE_INT_RGB);
        var graphics = image.createGraphics();
        try {
            graphics.setColor(color);
            graphics.fillRect(0, 0, image.getWidth(), image.getHeight());
        } finally {
            graphics.dispose();
        }
        var output = new ByteArrayOutputStream();
        ImageIO.write(image, "png", output);
        return output.toByteArray();
    }
}
