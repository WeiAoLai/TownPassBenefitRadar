package tw.gov.taipei.goodmorning.repository;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tw.gov.taipei.goodmorning.entity.Artwork;

public interface ArtworkRepository extends JpaRepository<Artwork, Long> {

    long countByOwnerId(Long ownerId);

    @EntityGraph(attributePaths = {"owner", "background", "policy"})
    Page<Artwork> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    @EntityGraph(attributePaths = {"owner", "background", "policy"})
    Page<Artwork> findByOwnerIdOrderByCreatedAtDescIdDesc(Long ownerId, Pageable pageable);

    @EntityGraph(attributePaths = {"owner", "background", "policy"})
    @Query("SELECT artwork FROM Artwork artwork WHERE artwork.id = :id")
    Optional<Artwork> findDetailedById(@Param("id") Long id);
}
