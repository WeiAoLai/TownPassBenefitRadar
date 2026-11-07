package tw.gov.taipei.goodmorning.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import tw.gov.taipei.goodmorning.entity.Artwork;

public interface ArtworkRepository extends JpaRepository<Artwork, Long> {

    Page<Artwork> findAllByOrderByCreatedAtDescIdDesc(Pageable pageable);

    Page<Artwork> findByOwnerIdOrderByCreatedAtDescIdDesc(Long ownerId, Pageable pageable);
}
