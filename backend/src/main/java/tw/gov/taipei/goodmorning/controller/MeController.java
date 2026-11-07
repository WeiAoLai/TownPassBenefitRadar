package tw.gov.taipei.goodmorning.controller;

import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.gov.taipei.goodmorning.dto.CurrentUserResponse;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.CurrentUserService;

@RestController
@RequestMapping(ApiPaths.V1)
public class MeController {

    private final CurrentUserService currentUserService;

    public MeController(CurrentUserService currentUserService) {
        this.currentUserService = currentUserService;
    }

    @GetMapping("/me")
    CurrentUserResponse getCurrentUser(@AuthenticationPrincipal CurrentUser currentUser) {
        return currentUserService.getCurrentUser(currentUser);
    }
}
