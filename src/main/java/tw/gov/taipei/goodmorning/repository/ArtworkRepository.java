package tw.gov.taipei.goodmorning.repository;

import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    @Query(
            value = "SELECT owner_id FROM artworks WHERE id = :id FOR UPDATE",
            nativeQuery = true)
    Optional<Long> findOwnerIdById(@Param("id") Long id);

    @Query("SELECT artwork.likeCount FROM Artwork artwork WHERE artwork.id = :id")
    long findLikeCountById(@Param("id") Long id);

    @Modifying
    @Query("""
            UPDATE Artwork artwork
               SET artwork.likeCount = artwork.likeCount + 1
             WHERE artwork.id = :id
            """)
    int incrementLikeCount(@Param("id") Long id);

    @Modifying
    @Query("""
            UPDATE Artwork artwork
               SET artwork.likeCount = artwork.likeCount - 1
             WHERE artwork.id = :id
               AND artwork.likeCount > 0
            """)
    int decrementLikeCount(@Param("id") Long id);
}
