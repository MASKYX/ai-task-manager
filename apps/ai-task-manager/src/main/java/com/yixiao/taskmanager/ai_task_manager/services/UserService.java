package com.yixiao.taskmanager.ai_task_manager.services;

import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.UserRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public UUID getOrCreateUserId(String cognitoSub) {
        return userRepository.findByCognitoSub(cognitoSub)
                .map(user -> {
                    user.markSeen();
                    return userRepository.save(user).getId();
                })
                .orElseGet(() -> createUser(cognitoSub));
    }

    private UUID createUser(String cognitoSub) {
        try {
            return userRepository.saveAndFlush(new UserEntity(cognitoSub)).getId();
        } catch (DataIntegrityViolationException ex) {
            return userRepository.findByCognitoSub(cognitoSub)
                    .map(UserEntity::getId)
                    .orElseThrow(() -> ex);
        }
    }
}
