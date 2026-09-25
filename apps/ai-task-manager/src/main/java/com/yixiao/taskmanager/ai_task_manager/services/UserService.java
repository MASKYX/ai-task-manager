package com.yixiao.taskmanager.ai_task_manager.services;

import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.UserRepository;
import com.yixiao.taskmanager.ai_task_manager.dto.AgentDtos.AiQuota;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;

@Service
public class UserService {

    private final UserRepository userRepository;
    private final Clock clock;
    private final int dailyAiRequestLimit;

    public UserService(UserRepository userRepository, Clock clock,
                       @Value("${agent.daily-request-limit:20}") int dailyAiRequestLimit) {
        this.userRepository = userRepository;
        this.clock = clock;
        this.dailyAiRequestLimit = dailyAiRequestLimit;
    }

    public UUID getOrCreateUserId(String cognitoSub) {
        return getOrCreateUser(cognitoSub).getId();
    }

    public UserEntity getOrCreateUser(String cognitoSub) {
        return userRepository.findByCognitoSub(cognitoSub)
                .orElseGet(() -> createUser(cognitoSub));
    }

    @Transactional
    public AiQuota getAiQuota(String cognitoSub) {
        UserEntity user = getUserForQuotaUpdate(cognitoSub);
        refreshQuota(user);
        return quotaOf(user);
    }

    @Transactional
    public QuotaConsumption consumeAiRequest(String cognitoSub) {
        UserEntity user = getUserForQuotaUpdate(cognitoSub);
        refreshQuota(user);
        boolean allowed = user.consumeAiRequest();
        return new QuotaConsumption(allowed, quotaOf(user));
    }

    public CalendarProviderType updateCalendarProvider(String cognitoSub, CalendarProviderType calendarProvider) {
        UserEntity user = getOrCreateUser(cognitoSub);
        user.setCalendarProvider(calendarProvider);
        return userRepository.save(user).getCalendarProvider();
    }

    private UserEntity createUser(String cognitoSub) {
        try {
            return userRepository.saveAndFlush(new UserEntity(cognitoSub));
        } catch (DataIntegrityViolationException ex) {
            return userRepository.findByCognitoSub(cognitoSub)
                    .orElseThrow(() -> ex);
        }
    }

    private UserEntity getUserForQuotaUpdate(String cognitoSub) {
        return userRepository.findForUpdateByCognitoSub(cognitoSub)
                .orElseGet(() -> createUser(cognitoSub));
    }

    private void refreshQuota(UserEntity user) {
        user.refreshAiQuota(LocalDate.now(clock), dailyAiRequestLimit);
    }

    private AiQuota quotaOf(UserEntity user) {
        return new AiQuota(user.getAiRequestsRemaining(), dailyAiRequestLimit);
    }

    public record QuotaConsumption(boolean allowed, AiQuota quota) {}
}
