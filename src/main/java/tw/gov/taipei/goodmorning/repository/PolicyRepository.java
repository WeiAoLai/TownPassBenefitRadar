package tw.gov.taipei.goodmorning.repository;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tw.gov.taipei.goodmorning.entity.Policy;

public interface PolicyRepository extends JpaRepository<Policy, Long> {

    @Query("""
            SELECT policy
              FROM Policy policy
             WHERE policy.active = true
               AND policy.startDate <= :date
               AND policy.endDate >= :date
             ORDER BY policy.id
            """)
    List<Policy> findAvailableOn(@Param("date") LocalDate date);
}
