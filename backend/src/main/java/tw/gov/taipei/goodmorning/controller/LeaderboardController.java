package tw.gov.taipei.goodmorning.controller;

import java.util.List;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tw.gov.taipei.goodmorning.dto.LeaderboardEntryResponse;
import tw.gov.taipei.goodmorning.security.CurrentUser;
import tw.gov.taipei.goodmorning.service.LeaderboardService;

@RestController
@RequestMapping(ApiPaths.V1)
public class LeaderboardController {

    private final LeaderboardService leaderboardService;

    public LeaderboardController(LeaderboardService leaderboardService) {
        this.leaderboardService = leaderboardService;
    }

    @GetMapping("/leaderboard")
    List<LeaderboardEntryResponse> getLeaderboard(
            @AuthenticationPrincipal CurrentUser currentUser) {
        return leaderboardService.get(currentUser);
    }
}
