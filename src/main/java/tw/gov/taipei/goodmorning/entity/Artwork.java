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
@Table(name = "artworks")
public class Artwork {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "owner_id", nullable = false)
    private User owner;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "background_id", nullable = false)
    private Background background;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "policy_id", nullable = false)
    private Policy policy;

    @Column(name = "slogan_text", nullable = false, length = 500)
    private String sloganText;

    @Column(name = "policy_source_url", nullable = false, length = 2048)
    private String policySourceUrl;

    @Column(name = "image_object_key", nullable = false, length = 512)
    private String imageObjectKey;

    @Column(name = "like_count", nullable = false)
    private long likeCount;

    @Column(name = "download_count", nullable = false)
    private long downloadCount;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected Artwork() {
    }

    public Artwork(
            User owner,
            Background background,
            Policy policy,
            String sloganText,
            String policySourceUrl,
            String imageObjectKey) {
        this.owner = owner;
        this.background = background;
        this.policy = policy;
        this.sloganText = sloganText;
        this.policySourceUrl = policySourceUrl;
        this.imageObjectKey = imageObjectKey;
    }

    public Long getId() {
        return id;
    }

    public User getOwner() {
        return owner;
    }

    public Background getBackground() {
        return background;
    }

    public Policy getPolicy() {
        return policy;
    }

    public String getSloganText() {
        return sloganText;
    }

    public String getPolicySourceUrl() {
        return policySourceUrl;
    }

    public String getImageObjectKey() {
        return imageObjectKey;
    }

    public long getLikeCount() {
        return likeCount;
    }

    public long getDownloadCount() {
        return downloadCount;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }
}
