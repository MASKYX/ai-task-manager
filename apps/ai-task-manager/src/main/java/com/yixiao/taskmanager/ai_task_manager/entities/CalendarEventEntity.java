package com.yixiao.taskmanager.ai_task_manager.entities;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(name = "calendar_events", schema = "public")
public class CalendarEventEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    @Column(name = "id", nullable = false, updatable = false)
    private UUID id;

    @Column(name = "user_id", nullable = false, updatable = false)
    private UUID userId;

    @Column(name = "summary")
    private String summary;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "start_date_time", nullable = false)
    private OffsetDateTime startDateTime;

    @Column(name = "end_date_time", nullable = false)
    private OffsetDateTime endDateTime;

    @Column(name = "all_day", nullable = false)
    private boolean allDay;

    protected CalendarEventEntity() {
    }

    public CalendarEventEntity(
            UUID userId,
            String summary,
            String description,
            OffsetDateTime startDateTime,
            OffsetDateTime endDateTime,
            boolean allDay
    ) {
        this.userId = userId;
        this.summary = summary;
        this.description = description;
        this.startDateTime = startDateTime;
        this.endDateTime = endDateTime;
        this.allDay = allDay;
    }

    public void update(
            String summary,
            String description,
            OffsetDateTime startDateTime,
            OffsetDateTime endDateTime,
            boolean allDay
    ) {
        this.summary = summary;
        this.description = description;
        this.startDateTime = startDateTime;
        this.endDateTime = endDateTime;
        this.allDay = allDay;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getSummary() {
        return summary;
    }

    public String getDescription() {
        return description;
    }

    public OffsetDateTime getStartDateTime() {
        return startDateTime;
    }

    public OffsetDateTime getEndDateTime() {
        return endDateTime;
    }

    public boolean isAllDay() {
        return allDay;
    }
}
