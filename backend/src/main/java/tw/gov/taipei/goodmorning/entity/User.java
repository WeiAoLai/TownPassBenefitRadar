package tw.gov.taipei.goodmorning.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sso_subject", nullable = false, length = 128)
    private String ssoSubject;

    @Column(nullable = false, length = 64)
    private String account;

    @Column(name = "display_name", nullable = false, length = 100)
    private String displayName;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false, insertable = false, updatable = false)
    private Instant updatedAt;

    protected User() {
    }

    public User(String ssoSubject, String account, String displayName) {
        this.ssoSubject = ssoSubject;
        this.account = account;
        this.displayName = displayName;
    }

    public Long getId() {
        return id;
    }

    public String getSsoSubject() {
        return ssoSubject;
    }

    public String getAccount() {
        return account;
    }

    public String getDisplayName() {
        return displayName;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
