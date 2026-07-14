package com.yixiao.taskmanager.ai_task_manager.repositories;

import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByCognitoSub(String cognitoSub);
}
