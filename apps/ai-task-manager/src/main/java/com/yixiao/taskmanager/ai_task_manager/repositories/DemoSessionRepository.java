package com.yixiao.taskmanager.ai_task_manager.repositories;

import com.yixiao.taskmanager.ai_task_manager.entities.DemoSessionEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface DemoSessionRepository extends JpaRepository<DemoSessionEntity, UUID> {
    Optional<DemoSessionEntity> findByTokenHash(String tokenHash);
    List<DemoSessionEntity> findByExpiresAtLessThanEqual(Instant now);
}
