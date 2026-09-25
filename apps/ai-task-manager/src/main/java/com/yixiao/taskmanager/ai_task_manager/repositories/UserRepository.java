package com.yixiao.taskmanager.ai_task_manager.repositories;

import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.Optional;
import java.util.UUID;

public interface UserRepository extends JpaRepository<UserEntity, UUID> {

    Optional<UserEntity> findByCognitoSub(String cognitoSub);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from UserEntity u where u.cognitoSub = :cognitoSub")
    Optional<UserEntity> findForUpdateByCognitoSub(@Param("cognitoSub") String cognitoSub);
}
