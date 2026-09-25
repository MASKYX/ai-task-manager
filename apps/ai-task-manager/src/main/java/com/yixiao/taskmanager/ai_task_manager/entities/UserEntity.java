package com.yixiao.taskmanager.ai_task_manager.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "users", schema = "public")
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "cognito_sub", nullable = false, unique = true)
    private String cognitoSub;

    @Enumerated(EnumType.STRING)
    @Column(name = "calendar_provider", nullable = false)
    private CalendarProviderType calendarProvider = CalendarProviderType.LOCAL;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    @Column(name = "ai_requests_remaining")
    private Integer aiRequestsRemaining = 20;

    @Column(name = "ai_quota_date")
    private LocalDate aiQuotaDate;

    protected UserEntity() {
    }

    public UserEntity(String cognitoSub) {
        this.cognitoSub = cognitoSub;
    }

    @PrePersist
    void onCreate() {
        this.updatedAt = OffsetDateTime.now();
    }

    @PreUpdate
    void onUpdate() {
        this.updatedAt = OffsetDateTime.now();
    }

    public void markSeen() {
        this.updatedAt = OffsetDateTime.now();
    }

    public UUID getId() {
        return id;
    }

    public String getCognitoSub() {
        return cognitoSub;
    }

    public CalendarProviderType getCalendarProvider() {
        return calendarProvider;
    }

    public void setCalendarProvider(CalendarProviderType calendarProvider) {
        this.calendarProvider = calendarProvider;
    }

    public int getAiRequestsRemaining() {
        return aiRequestsRemaining == null ? 0 : aiRequestsRemaining;
    }

    public LocalDate getAiQuotaDate() {
        return aiQuotaDate;
    }

    public void refreshAiQuota(LocalDate today, int dailyLimit) {
        if (!today.equals(aiQuotaDate) || aiRequestsRemaining == null) {
            aiRequestsRemaining = dailyLimit;
            aiQuotaDate = today;
        }
    }

    public boolean consumeAiRequest() {
        if (aiRequestsRemaining == null || aiRequestsRemaining <= 0) return false;
        aiRequestsRemaining--;
        return true;
    }
}
