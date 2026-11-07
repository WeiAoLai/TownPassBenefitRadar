package tw.gov.taipei.goodmorning.controller;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import tw.gov.taipei.goodmorning.dto.PolicyResponse;
import tw.gov.taipei.goodmorning.service.PolicyService;

@Validated
@RestController
public class PolicyController {

    private final PolicyService policyService;

    public PolicyController(PolicyService policyService) {
        this.policyService = policyService;
    }

    @GetMapping("/policy-categories")
    List<String> listCategories() {
        return policyService.listCategories();
    }

    @GetMapping("/policies")
    List<PolicyResponse> listPolicies(
            @RequestParam @NotBlank @Size(max = 100) String category) {
        return policyService.listPolicies(category);
    }

    @GetMapping("/policies/random")
    PolicyResponse randomPolicy() {
        return policyService.randomPolicy();
    }
}
