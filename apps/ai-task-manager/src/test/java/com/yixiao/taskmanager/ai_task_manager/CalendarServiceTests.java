package com.yixiao.taskmanager.ai_task_manager;

import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import com.yixiao.taskmanager.ai_task_manager.services.calendar.CalendarService;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class CalendarServiceTests {
    @Test
    void retrievesAuthenticatedUsersProvider() {
        UserService users = mock(UserService.class);
        UserEntity user = new UserEntity("cognito-user");
        user.setCalendarProvider(CalendarProviderType.GOOGLE);
        when(users.getOrCreateUser("cognito-user")).thenReturn(user);
        Jwt token = Jwt.withTokenValue("token").header("alg", "none")
                .claim("sub", "cognito-user").issuedAt(Instant.now())
                .expiresAt(Instant.now().plusSeconds(60)).build();
        CalendarService service = new CalendarService(users, List.of());
        assertEquals(CalendarProviderType.GOOGLE, service.getProviderType(new JwtAuthenticationToken(token)));
    }
}
