package tw.gov.taipei.goodmorning.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "backgrounds")
public class Background {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "image_object_key", nullable = false, length = 512)
    private String imageObjectKey;

    @Column(name = "unlock_threshold", nullable = false)
    private int unlockThreshold;

    @Column(name = "is_active", nullable = false)
    private boolean active;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    protected Background() {
    }

    public Background(String name, String imageObjectKey, int unlockThreshold, boolean active) {
        this.name = name;
        this.imageObjectKey = imageObjectKey;
        this.unlockThreshold = unlockThreshold;
        this.active = active;
    }

    public Long getId() {
        return id;
    }

    public String getName() {
        return name;
    }

    public String getImageObjectKey() {
        return imageObjectKey;
    }

    public int getUnlockThreshold() {
        return unlockThreshold;
    }

    public boolean isActive() {
        return active;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
