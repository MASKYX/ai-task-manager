package com.yixiao.taskmanager.ai_task_manager.repositories;

import com.yixiao.taskmanager.ai_task_manager.entities.CalendarEventEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface CalendarEventRepository extends JpaRepository<CalendarEventEntity, UUID> {

    List<CalendarEventEntity> findTop10ByUserIdAndEndDateTimeGreaterThanOrderByStartDateTimeAsc(
            UUID userId,
            OffsetDateTime timeMin
    );

    List<CalendarEventEntity> findByUserIdAndEndDateTimeGreaterThanAndStartDateTimeLessThanOrderByStartDateTimeAsc(
            UUID userId,
            OffsetDateTime timeMin,
            OffsetDateTime timeMax
    );

    List<CalendarEventEntity> findByUserIdOrderByStartDateTimeAsc(UUID userId);

    Optional<CalendarEventEntity> findByIdAndUserId(UUID id, UUID userId);
}
