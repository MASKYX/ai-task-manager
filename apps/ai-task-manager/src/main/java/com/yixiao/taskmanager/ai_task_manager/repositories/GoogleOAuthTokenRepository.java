package com.yixiao.taskmanager.ai_task_manager.repositories;

import com.yixiao.taskmanager.ai_task_manager.entities.GoogleOAuthTokenEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface GoogleOAuthTokenRepository extends JpaRepository<GoogleOAuthTokenEntity, UUID> {

    Optional<GoogleOAuthTokenEntity> findByUserIdAndRevokedAtIsNull(UUID userId);
}
