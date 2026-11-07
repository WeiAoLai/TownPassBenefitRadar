package tw.gov.taipei.goodmorning.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.CreateArtworkService;

@Validated
@RestController
public class ArtworkController {

    private final CreateArtworkService createArtworkService;

    public ArtworkController(CreateArtworkService createArtworkService) {
        this.createArtworkService = createArtworkService;
    }

    @PostMapping(value = "/artworks", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    ResponseEntity<ArtworkResponse> createArtwork(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestPart("image") MultipartFile image,
            @RequestParam @Positive long backgroundId,
            @RequestParam @Positive long policyId,
            @RequestParam @NotBlank @Size(max = 500) String sloganText,
            HttpServletRequest request) throws IOException {
        var artwork = createArtworkService.create(
                currentUser, image.getBytes(), backgroundId, policyId, sloganText);
        var location = URI.create("%s/artworks/%d".formatted(request.getContextPath(), artwork.id()));
        return ResponseEntity.created(location).body(artwork);
    }
}
