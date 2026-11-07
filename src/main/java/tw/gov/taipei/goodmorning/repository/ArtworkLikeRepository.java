package tw.gov.taipei.goodmorning.repository;

import java.util.Set;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import tw.gov.taipei.goodmorning.entity.ArtworkLike;

public interface ArtworkLikeRepository extends JpaRepository<ArtworkLike, Long> {

    boolean existsByUserIdAndArtworkId(Long userId, Long artworkId);

    @Query("""
            SELECT artworkLike.artwork.id
              FROM ArtworkLike artworkLike
             WHERE artworkLike.user.id = :userId
               AND artworkLike.artwork.id IN :artworkIds
            """)
    Set<Long> findArtworkIdsByUserIdAndArtworkIdIn(
            @Param("userId") Long userId,
            @Param("artworkIds") Set<Long> artworkIds);

    @Modifying
    @Query(
            value = """
                    INSERT IGNORE INTO artwork_likes (user_id, artwork_id)
                    VALUES (:userId, :artworkId)
                    """,
            nativeQuery = true)
    int insertIfAbsent(
            @Param("userId") Long userId,
            @Param("artworkId") Long artworkId);

    @Modifying
    @Query("""
            DELETE FROM ArtworkLike artworkLike
             WHERE artworkLike.user.id = :userId
               AND artworkLike.artwork.id = :artworkId
            """)
    int deleteByUserIdAndArtworkId(
            @Param("userId") Long userId,
            @Param("artworkId") Long artworkId);
}
