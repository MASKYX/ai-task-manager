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

    public UUID getOrCreateUserId(String userKey) {
        return getOrCreateUser(userKey).getId();
    }

    public UserEntity getOrCreateUser(String userKey) {
        return userRepository.findByCognitoSub(userKey)
                .orElseGet(() -> createRealUser(userKey));
    }

    @Transactional
    public AiQuota getAiQuota(String userKey) {
        UserEntity user = getUserForQuotaUpdate(userKey);
        refreshQuota(user);
        return quotaOf(user);
    }

    @Transactional
    public QuotaConsumption consumeAiRequest(String userKey) {
        UserEntity user = getUserForQuotaUpdate(userKey);
        refreshQuota(user);
        boolean allowed = user.consumeAiRequest();
        return new QuotaConsumption(allowed, quotaOf(user));
    }

    public CalendarProviderType updateCalendarProvider(String userKey, CalendarProviderType calendarProvider) {
        UserEntity user = getOrCreateUser(userKey);
        user.setCalendarProvider(calendarProvider);
        return userRepository.save(user).getCalendarProvider();
    }

    private UserEntity createRealUser(String userKey) {
        // Demo rows are created only when a session starts; never recreate an expired one.
        if (userKey.startsWith("demo:")) throw new IllegalStateException("Demo session no longer exists");
        try {
            return userRepository.saveAndFlush(new UserEntity(userKey));
        } catch (DataIntegrityViolationException ex) {
            return userRepository.findByCognitoSub(userKey)
                    .orElseThrow(() -> ex);
        }
    }

    private UserEntity getUserForQuotaUpdate(String userKey) {
        return userRepository.findForUpdateByCognitoSub(userKey)
                .orElseGet(() -> createRealUser(userKey));
    }

    private void refreshQuota(UserEntity user) {
        user.refreshAiQuota(LocalDate.now(clock), dailyAiRequestLimit);
    }

    private AiQuota quotaOf(UserEntity user) {
        return new AiQuota(user.getAiRequestsRemaining(), dailyAiRequestLimit);
    }

    public record QuotaConsumption(boolean allowed, AiQuota quota) {}
}
