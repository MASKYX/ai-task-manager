package com.yixiao.taskmanager.ai_task_manager.services;

import com.yixiao.taskmanager.ai_task_manager.entities.DemoSessionEntity;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.DemoSessionRepository;
import com.yixiao.taskmanager.ai_task_manager.repositories.UserRepository;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Base64;
import java.util.HashMap;
import java.util.Map;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;

@Service
public class DemoSessionService {
    public static final String COOKIE_NAME = "TASKAI_DEMO";
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final int MAX_DAILY_SESSIONS_PER_IP = 5;

    private final DemoSessionRepository sessions;
    private final UserRepository users;
    private final Clock clock;
    private final Map<String, Integer> dailySessionCounts = new HashMap<>();
    private LocalDate counterDate;

    public DemoSessionService(DemoSessionRepository sessions, UserRepository users, Clock clock) {
        this.sessions = sessions;
        this.users = users;
        this.clock = clock;
    }

    public synchronized boolean canCreateSession(String clientIp) {
        if (clientIp == null || clientIp.isBlank()) return false;
        LocalDate today = LocalDate.now(clock);
        if (!today.equals(counterDate)) {
            dailySessionCounts.clear();
            counterDate = today;
        }
        int count = dailySessionCounts.getOrDefault(clientIp, 0);
        if (count >= MAX_DAILY_SESSIONS_PER_IP) return false;
        dailySessionCounts.put(clientIp, count + 1);
        return true;
    }

    @Transactional
    public String start() {
        UUID sessionId = UUID.randomUUID();
        byte[] tokenBytes = new byte[32];
        RANDOM.nextBytes(tokenBytes);
        String token = Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
        UserEntity user = users.saveAndFlush(new UserEntity("demo:" + sessionId));
        sessions.saveAndFlush(new DemoSessionEntity(sessionId, user.getId(), hash(token),
                Instant.now(clock).plusSeconds(3600)));
        return token;
    }

    @Transactional(readOnly = true)
    public Optional<DemoSessionEntity> findValid(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) return Optional.empty();
        return sessions.findByTokenHash(hash(token))
                .filter(session -> session.getExpiresAt().isAfter(Instant.now(clock)));
    }

    @Transactional
    public void end(String token) {
        if (token == null || !token.matches("[A-Za-z0-9_-]{43}")) return;
        sessions.findByTokenHash(hash(token)).ifPresent(session -> users.deleteById(session.getUserId()));
    }

    @Scheduled(initialDelayString = "PT1M", fixedDelayString = "PT5M")
    @Transactional
    public void deleteExpired() {
        var expiredUserIds = sessions.findByExpiresAtLessThanEqual(Instant.now(clock))
                .stream().map(DemoSessionEntity::getUserId).toList();
        if (!expiredUserIds.isEmpty()) users.deleteAllByIdInBatch(expiredUserIds);
    }

    private static String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(token.getBytes(StandardCharsets.US_ASCII));
            return HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException ex) {
            throw new IllegalStateException("SHA-256 unavailable", ex);
        }
    }
}
