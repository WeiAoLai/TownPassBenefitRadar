CREATE TABLE users (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    sso_subject VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    account VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_users_sso_subject (sso_subject),
    UNIQUE KEY uk_users_account (account)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE backgrounds (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    image_object_key VARCHAR(512) COLLATE utf8mb4_bin NOT NULL,
    unlock_threshold INT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_backgrounds_image_object_key (image_object_key),
    KEY idx_backgrounds_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE policies (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    slogan VARCHAR(500) NOT NULL,
    source_url VARCHAR(2048) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
        ON UPDATE CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_policies_available_category
        (is_active, category, start_date, end_date),
    CONSTRAINT chk_policies_source_url_https CHECK (source_url LIKE 'https://%'),
    CONSTRAINT chk_policies_date_range CHECK (end_date >= start_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE artworks (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    owner_id BIGINT UNSIGNED NOT NULL,
    background_id BIGINT UNSIGNED NOT NULL,
    policy_id BIGINT UNSIGNED NOT NULL,
    slogan_text VARCHAR(500) NOT NULL,
    policy_source_url VARCHAR(2048) NOT NULL,
    image_object_key VARCHAR(512) COLLATE utf8mb4_bin NOT NULL,
    like_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    download_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_artworks_image_object_key (image_object_key),
    KEY idx_artworks_owner_created (owner_id, created_at DESC, id DESC),
    KEY idx_artworks_created (created_at DESC, id DESC),
    KEY idx_artworks_background (background_id),
    KEY idx_artworks_policy (policy_id),
    CONSTRAINT fk_artworks_owner
        FOREIGN KEY (owner_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_artworks_background
        FOREIGN KEY (background_id) REFERENCES backgrounds (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_artworks_policy
        FOREIGN KEY (policy_id) REFERENCES policies (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT chk_artworks_policy_source_url_https
        CHECK (policy_source_url LIKE 'https://%'),
    CONSTRAINT chk_artworks_like_count CHECK (like_count >= 0),
    CONSTRAINT chk_artworks_download_count CHECK (download_count >= 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE artwork_likes (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    artwork_id BIGINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    UNIQUE KEY uk_artwork_likes_user_artwork (user_id, artwork_id),
    KEY idx_artwork_likes_artwork (artwork_id),
    CONSTRAINT fk_artwork_likes_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT,
    CONSTRAINT fk_artwork_likes_artwork
        FOREIGN KEY (artwork_id) REFERENCES artworks (id)
        ON UPDATE RESTRICT ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
