package tw.gov.taipei.goodmorning.controller;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.gov.taipei.goodmorning.dto.BackgroundResponse;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.BackgroundService;
import tw.gov.taipei.goodmorning.service.CurrentUserService;

@RestController
public class BackgroundController {

    private final BackgroundService backgroundService;
    private final CurrentUserService currentUserService;

    public BackgroundController(
            BackgroundService backgroundService, CurrentUserService currentUserService) {
        this.backgroundService = backgroundService;
        this.currentUserService = currentUserService;
    }

    @GetMapping("/backgrounds")
    List<BackgroundResponse> listBackgrounds(@AuthenticationPrincipal CurrentUser currentUser) {
        return backgroundService.listBackgrounds(currentUserService.getArtworkCount(currentUser));
    }
}
