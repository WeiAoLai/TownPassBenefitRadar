package tw.gov.taipei.goodmorning.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tw.gov.taipei.goodmorning.dto.PolicyResponse;
import tw.gov.taipei.goodmorning.entity.Policy;
import tw.gov.taipei.goodmorning.repository.PolicyRepository;

@Service
public class PolicyService {

    private final PolicyRepository policies;
    private final Clock clock;

    public PolicyService(PolicyRepository policies, Clock clock) {
        this.policies = policies;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<String> listCategories() {
        return availablePolicies().stream()
                .map(Policy::getCategory)
                .distinct()
                .sorted()
                .toList();
    }

    @Transactional(readOnly = true)
    public List<PolicyResponse> listPolicies(String category) {
        return availablePolicies().stream()
                .filter(policy -> policy.getCategory().equals(category))
                .map(PolicyService::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public PolicyResponse randomPolicy() {
        var available = availablePolicies();
        if (available.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No policy is currently available");
        }
        return toResponse(available.get(ThreadLocalRandom.current().nextInt(available.size())));
    }

    private List<Policy> availablePolicies() {
        return policies.findAvailableOn(LocalDate.now(clock));
    }

    static PolicyResponse toResponse(Policy policy) {
        return new PolicyResponse(
                policy.getId(),
                policy.getCategory(),
                policy.getTitle(),
                policy.getSlogan(),
                policy.getSourceUrl(),
                policy.getStartDate(),
                policy.getEndDate());
    }
}
