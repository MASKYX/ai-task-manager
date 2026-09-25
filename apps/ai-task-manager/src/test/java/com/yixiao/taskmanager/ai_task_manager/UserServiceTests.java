package com.yixiao.taskmanager.ai_task_manager;

import com.yixiao.taskmanager.ai_task_manager.dto.AgentDtos.AiQuota;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.UserRepository;
import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.Test;
import org.springframework.data.jpa.repository.Lock;

import java.lang.reflect.Method;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class UserServiceTests {
    private static final String USER = "user-1";

    @Test
    void newUserStartsWithTwentyRequestsAndRequestsDecrementToZero() {
        UserRepository repository = mock(UserRepository.class);
        UserEntity user = new UserEntity(USER);
        when(repository.findForUpdateByCognitoSub(USER)).thenReturn(Optional.of(user));
        UserService service = service(repository, "2026-09-23T10:00:00Z");

        assertEquals(new AiQuota(20, 20), service.getAiQuota(USER));
        assertEquals(19, service.consumeAiRequest(USER).quota().remaining());
        assertEquals(18, service.consumeAiRequest(USER).quota().remaining());
        for (int i = 0; i < 18; i++) assertTrue(service.consumeAiRequest(USER).allowed());

        UserService.QuotaConsumption exhausted = service.consumeAiRequest(USER);
        assertFalse(exhausted.allowed());
        assertEquals(0, exhausted.quota().remaining());
    }

    @Test
    void quotaResetsWhenConfiguredClockMovesToNextDate() {
        UserRepository repository = mock(UserRepository.class);
        UserEntity user = new UserEntity(USER);
        when(repository.findForUpdateByCognitoSub(USER)).thenReturn(Optional.of(user));
        UserService firstDay = service(repository, "2026-09-23T10:00:00Z");
        firstDay.consumeAiRequest(USER);

        UserService nextDay = service(repository, "2026-09-24T10:00:00Z");
        assertEquals(new AiQuota(20, 20), nextDay.getAiQuota(USER));
    }

    @Test
    void quotaReadsUseDatabaseWriteLockForConcurrentRequests() throws Exception {
        Method method = UserRepository.class.getMethod("findForUpdateByCognitoSub", String.class);
        Lock lock = method.getAnnotation(Lock.class);
        assertNotNull(lock);
        assertEquals(LockModeType.PESSIMISTIC_WRITE, lock.value());
    }

    private UserService service(UserRepository repository, String instant) {
        Clock clock = Clock.fixed(Instant.parse(instant), ZoneOffset.UTC);
        return new UserService(repository, clock, 20);
    }
}
