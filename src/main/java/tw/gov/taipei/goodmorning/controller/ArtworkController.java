package tw.gov.taipei.goodmorning.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tw.gov.taipei.goodmorning.dto.ArtworkPageResponse;
import tw.gov.taipei.goodmorning.dto.ArtworkResponse;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.ArtworkQueryService;
import tw.gov.taipei.goodmorning.service.CreateArtworkService;

@Validated
@RestController
public class ArtworkController {

    private final CreateArtworkService createArtworkService;
    private final ArtworkQueryService artworkQueryService;

    public ArtworkController(
            CreateArtworkService createArtworkService,
            ArtworkQueryService artworkQueryService) {
        this.createArtworkService = createArtworkService;
        this.artworkQueryService = artworkQueryService;
    }

    @GetMapping("/artworks")
    ArtworkPageResponse listArtworks(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return artworkQueryService.listPublic(currentUser, page, size);
    }

    @GetMapping("/me/artworks")
    ArtworkPageResponse listMyArtworks(
            @AuthenticationPrincipal CurrentUser currentUser,
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return artworkQueryService.listMine(currentUser, page, size);
    }

    @GetMapping("/artworks/{artworkId}")
    ArtworkResponse getArtwork(
            @AuthenticationPrincipal CurrentUser currentUser,
            @PathVariable @Positive long artworkId) {
        return artworkQueryService.get(currentUser, artworkId);
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
