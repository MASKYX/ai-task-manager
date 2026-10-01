package com.yixiao.taskmanager.ai_task_manager;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.exception.AgentException;
import com.yixiao.taskmanager.ai_task_manager.repositories.CalendarEventRepository;
import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import com.yixiao.taskmanager.ai_task_manager.services.calendar.CalendarService;
import com.yixiao.taskmanager.ai_task_manager.services.calendar.LocalCalendarProvider;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CalendarSecurityTests {
    @Test
    void anotherUsersEventCannotBeUpdatedOrDeleted() {
        CalendarEventRepository repository = mock(CalendarEventRepository.class);
        LocalCalendarProvider provider = new LocalCalendarProvider(repository);
        UUID ownUser = UUID.randomUUID();
        String otherEventId = UUID.randomUUID().toString();
        when(repository.findByIdAndUserId(UUID.fromString(otherEventId), ownUser)).thenReturn(Optional.empty());
        CalendarEventDto replacement = event("<img src=x onerror=alert(1)>", "<script>alert(1)</script>");
        assertThrows(AgentException.class,
                () -> provider.updateEvent(ownUser, otherEventId, replacement));
        assertThrows(AgentException.class,
                () -> provider.deleteEvent(ownUser, otherEventId));
        verify(repository, never()).save(any());
        verify(repository, never()).delete(any());
    }

    @Test
    void invalidDatesAndIdsAreRejectedBeforeProviderAccess() {
        UserService users = mock(UserService.class);
        UserEntity user = new UserEntity("own-sub");
        user.setCalendarProvider(CalendarProviderType.LOCAL);
        when(users.getOrCreateUser("own-sub")).thenReturn(user);
        LocalCalendarProvider provider = mock(LocalCalendarProvider.class);
        when(provider.getType()).thenReturn(CalendarProviderType.LOCAL);
        CalendarService service = new CalendarService(users, List.of(provider));
        Jwt jwt = Jwt.withTokenValue("token").header("alg", "none").claim("sub", "own-sub")
                .issuedAt(Instant.now()).expiresAt(Instant.now().plusSeconds(60)).build();
        var authentication = new JwtAuthenticationToken(jwt);
        assertThrows(AgentException.class,
                () -> service.createEvent(authentication, event("normal", "x".repeat(10001))));
        assertThrows(AgentException.class,
                () -> service.deleteEvent(authentication, "\ninvalid"));
        assertThrows(AgentException.class,
                () -> service.getEventsInDateRange(authentication, "bad-date", "2026-01-02T00:00:00Z"));
        verify(provider, never()).createEvent(any(), any());
        verify(provider, never()).deleteEvent(any(), any());
        verify(provider, never()).getEventsInDateRange(any(), any(), any());
    }

    private static CalendarEventDto event(String summary, String description) {
        return CalendarEventDto.builder().summary(summary).description(description)
                .startDateTime("2026-01-01T12:00:00Z").endDateTime("2026-01-01T13:00:00Z")
                .allDay(false).build();
    }
}
