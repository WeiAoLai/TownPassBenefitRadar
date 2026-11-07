package tw.gov.taipei.goodmorning.service;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.WriterException;
import com.google.zxing.qrcode.QRCodeWriter;
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.Map;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Component;

@Component
public class QrCodeComposer {

    private static final int OUTPUT_SIZE = 1080;

    public byte[] compose(byte[] sourcePng, String content) {
        try {
            var source = ImageIO.read(new ByteArrayInputStream(sourcePng));
            if (source == null || source.getWidth() != OUTPUT_SIZE || source.getHeight() != OUTPUT_SIZE) {
                throw new IllegalArgumentException("Stored artwork must be a 1080 x 1080 PNG");
            }

            var output = new BufferedImage(OUTPUT_SIZE, OUTPUT_SIZE, BufferedImage.TYPE_INT_RGB);
            var graphics = output.createGraphics();
            try {
                graphics.drawImage(source, 0, 0, null);
            } finally {
                graphics.dispose();
            }
            drawQrPanel(output, content);

            var bytes = new ByteArrayOutputStream();
            if (!ImageIO.write(output, "png", bytes)) {
                throw new IllegalStateException("PNG encoder is unavailable");
            }
            return bytes.toByteArray();
        } catch (IOException | WriterException exception) {
            throw new IllegalStateException("Failed to compose artwork QR code", exception);
        }
    }

    private void drawQrPanel(BufferedImage image, String content) throws WriterException {
        var shortEdge = Math.min(image.getWidth(), image.getHeight());
        var panelSize = shortEdge / 5;
        var outerMargin = shortEdge / 40;
        var panelPadding = shortEdge / 60;
        var qrSize = panelSize - (panelPadding * 2);
        var panelX = image.getWidth() - outerMargin - panelSize;
        var panelY = image.getHeight() - outerMargin - panelSize;

        var graphics = image.createGraphics();
        try {
            graphics.setColor(Color.WHITE);
            graphics.fillRect(panelX, panelY, panelSize, panelSize);

            var hints = Map.of(
                    EncodeHintType.ERROR_CORRECTION, ErrorCorrectionLevel.H,
                    EncodeHintType.MARGIN, 0,
                    EncodeHintType.CHARACTER_SET, "UTF-8");
            var matrix = new QRCodeWriter().encode(
                    content, BarcodeFormat.QR_CODE, qrSize, qrSize, hints);
            graphics.setColor(Color.BLACK);
            for (var y = 0; y < matrix.getHeight(); y++) {
                for (var x = 0; x < matrix.getWidth(); x++) {
                    if (matrix.get(x, y)) {
                        graphics.fillRect(panelX + panelPadding + x, panelY + panelPadding + y, 1, 1);
                    }
                }
            }
        } finally {
            graphics.dispose();
        }
    }
}
