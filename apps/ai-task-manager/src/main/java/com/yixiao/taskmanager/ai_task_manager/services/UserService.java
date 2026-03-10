package com.yixiao.taskmanager.ai_task_manager.services;

import com.yixiao.taskmanager.ai_task_manager.mappers.UserMapper;
import org.springframework.stereotype.Service;

import java.util.UUID;

@Service
public class UserService {

    private final UserMapper userMapper;

    public UserService(UserMapper userMapper) {
        this.userMapper = userMapper;
    }

    public UUID getOrCreateUserId(String cognitoSub) {
        return UUID.fromString(userMapper.upsertAndGetId(cognitoSub));
    }
}