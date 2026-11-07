package tw.gov.taipei.goodmorning.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tw.gov.taipei.goodmorning.entity.ArtworkLike;

public interface ArtworkLikeRepository extends JpaRepository<ArtworkLike, Long> {

    boolean existsByUserIdAndArtworkId(Long userId, Long artworkId);
}
