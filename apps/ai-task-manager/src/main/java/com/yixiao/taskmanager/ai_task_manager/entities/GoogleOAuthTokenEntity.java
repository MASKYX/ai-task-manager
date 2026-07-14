package com.yixiao.taskmanager.ai_task_manager.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "google_oauth_tokens", schema = "public")
public class GoogleOAuthTokenEntity {

    @Id
    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "refresh_token")
    private String refreshToken;

    @Column(name = "access_token")
    private String accessToken;

    @Column(name = "expires_at")
    private OffsetDateTime expiresAt;

    @Column(name = "scope")
    private String scope;

    @Column(name = "revoked_at")
    private OffsetDateTime revokedAt;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected GoogleOAuthTokenEntity() {
    }

    public GoogleOAuthTokenEntity(UUID userId) {
        this.userId = userId;
    }

    @PrePersist
    void onCreate() {
        this.updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public void applyTokens(String refreshToken, String accessToken, OffsetDateTime expiresAt, String scope) {
        if (refreshToken != null) {
            this.refreshToken = refreshToken;
        }
        this.accessToken = accessToken;
        this.expiresAt = expiresAt;
        this.scope = scope;
        this.revokedAt = null;
    }

    public void revoke() {
        this.revokedAt = OffsetDateTime.now();
    }

    public UUID getUserId() {
        return userId;
    }

    public String getRefreshToken() {
        return refreshToken;
    }

    public String getAccessToken() {
        return accessToken;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

    public OffsetDateTime getRevokedAt() {
        return revokedAt;
    }
}
