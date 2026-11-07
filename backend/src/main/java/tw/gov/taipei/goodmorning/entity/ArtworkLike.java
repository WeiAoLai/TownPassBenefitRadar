package tw.gov.taipei.goodmorning.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "artwork_likes")
public class ArtworkLike {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "artwork_id", nullable = false)
    private Artwork artwork;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected ArtworkLike() {
    }

    public ArtworkLike(User user, Artwork artwork) {
        this.user = user;
        this.artwork = artwork;
    }

    public Long getId() {
        return id;
    }

    public User getUser() {
        return user;
    }

    public Artwork getArtwork() {
        return artwork;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
