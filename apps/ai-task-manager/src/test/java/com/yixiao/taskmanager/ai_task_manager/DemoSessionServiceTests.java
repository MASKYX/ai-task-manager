package com.yixiao.taskmanager.ai_task_manager;

import com.yixiao.taskmanager.ai_task_manager.entities.DemoSessionEntity;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.DemoSessionRepository;
import com.yixiao.taskmanager.ai_task_manager.repositories.UserRepository;
import com.yixiao.taskmanager.ai_task_manager.services.DemoSessionService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

class DemoSessionServiceTests {
    private final DemoSessionRepository sessions = mock(DemoSessionRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final Clock clock = Clock.fixed(Instant.parse("2026-10-01T12:00:00Z"), ZoneOffset.UTC);
    private final DemoSessionService service = new DemoSessionService(sessions, users, clock);

    @Test
    void startCreatesDistinctUsersAndHashedOneHourTokens() {
        when(users.saveAndFlush(any(UserEntity.class))).thenAnswer(invocation -> {
            UserEntity saved = mock(UserEntity.class);
            when(saved.getId()).thenReturn(UUID.randomUUID());
            return saved;
        });

        String first = service.start();
        String second = service.start();

        assertEquals(43, first.length());
        assertNotEquals(first, second);
        ArgumentCaptor<UserEntity> userCaptor = ArgumentCaptor.forClass(UserEntity.class);
        verify(users, times(2)).saveAndFlush(userCaptor.capture());
        assertNotEquals(userCaptor.getAllValues().get(0).getCognitoSub(),
                userCaptor.getAllValues().get(1).getCognitoSub());
        assertTrue(userCaptor.getAllValues().stream().allMatch(user ->
                user.getCognitoSub().startsWith("demo:")));

        ArgumentCaptor<DemoSessionEntity> sessionCaptor = ArgumentCaptor.forClass(DemoSessionEntity.class);
        verify(sessions, times(2)).saveAndFlush(sessionCaptor.capture());
        DemoSessionEntity stored = sessionCaptor.getAllValues().get(0);
        assertEquals(Instant.parse("2026-10-01T13:00:00Z"), stored.getExpiresAt());
        assertEquals(64, stored.getTokenHash().length());
        assertNotEquals(first, stored.getTokenHash());

        when(sessions.findByTokenHash(stored.getTokenHash())).thenReturn(Optional.of(stored));
        assertEquals(stored.getId(), service.findValid(first).orElseThrow().getId());
    }

    @Test
    void expiredSessionCannotAuthenticateAndCleanupDeletesItsUser() {
        UUID userId = UUID.randomUUID();
        DemoSessionEntity expired = new DemoSessionEntity(UUID.randomUUID(), userId,
                "a".repeat(64), Instant.parse("2026-10-01T11:59:59Z"));
        when(sessions.findByTokenHash(any())).thenReturn(Optional.of(expired));
        when(sessions.findByExpiresAtLessThanEqual(Instant.now(clock))).thenReturn(List.of(expired));

        assertTrue(service.findValid("a".repeat(43)).isEmpty());
        service.deleteExpired();

        verify(users).deleteAllByIdInBatch(List.of(userId));
    }

    @Test
    void endingDemoDeletesItsUserImmediately() {
        UUID userId = UUID.randomUUID();
        DemoSessionEntity session = new DemoSessionEntity(UUID.randomUUID(), userId,
                "b".repeat(64), Instant.now(clock).plusSeconds(60));
        when(sessions.findByTokenHash(any())).thenReturn(Optional.of(session));

        service.end("b".repeat(43));

        verify(users).deleteById(userId);
    }
}
