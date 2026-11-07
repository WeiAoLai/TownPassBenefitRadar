package tw.gov.taipei.goodmorning.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import org.junit.jupiter.api.Test;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.repository.PolicyRepository;

class PolicyServiceTest {

    private static final ZoneId TAIPEI = ZoneId.of("Asia/Taipei");
    private static final LocalDate TODAY = LocalDate.of(2026, 11, 7);

    @Test
    void usesTaipeiLocalDateAndFiltersByCategory() {
        var repository = mock(PolicyRepository.class);
        var clock = Clock.fixed(Instant.parse("2026-11-06T16:30:00Z"), TAIPEI);
        var welfare = policy("社福", "敬老卡");
        var traffic = policy("交通", "安全宣導");
        when(repository.findAvailableOn(TODAY)).thenReturn(List.of(welfare, traffic));
        var service = new PolicyService(repository, clock);

        assertThat(service.listCategories()).containsExactly("交通", "社福");
        assertThat(service.listPolicies("社福"))
                .extracting(response -> response.title())
                .containsExactly("敬老卡");
        assertThat(service.randomPolicy()).isIn(
                PolicyService.toResponse(welfare), PolicyService.toResponse(traffic));
    }

    private Policy policy(String category, String title) {
        return new Policy(
                category,
                title,
                "早安台北",
                "https://example.gov.tw/policy",
                TODAY.minusDays(1),
                TODAY.plusDays(1),
                true);
    }
}
