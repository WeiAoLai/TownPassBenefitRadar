package tw.gov.taipei.goodmorning.repository;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import tw.gov.taipei.goodmorning.entity.Background;

public interface BackgroundRepository extends JpaRepository<Background, Long> {

    List<Background> findByActiveTrueOrderByUnlockThresholdAscIdAsc();
}
