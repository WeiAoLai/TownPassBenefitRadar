package tw.gov.taipei.goodmorning.repository;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import tw.gov.taipei.goodmorning.entity.User;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findBySsoSubject(String ssoSubject);
}
