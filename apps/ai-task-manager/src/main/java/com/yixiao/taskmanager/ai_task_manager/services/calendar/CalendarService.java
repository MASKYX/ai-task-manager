package com.yixiao.taskmanager.ai_task_manager.services.calendar;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;

@Service
public class CalendarService {

    private final UserService userService;
    private final Map<CalendarProviderType, CalendarProvider> providers;

    public CalendarService(UserService userService, List<CalendarProvider> calendarProviders) {
        this.userService = userService;
        this.providers = new EnumMap<>(CalendarProviderType.class);
        calendarProviders.forEach(provider -> providers.put(provider.getType(), provider));
    }

    public CalendarProviderType getProviderType(Authentication authentication) {
        return getUser(authentication).getCalendarProvider();
    }

    public List<CalendarEventDto> getAllEvents(Authentication authentication) {
        UserEntity user = getUser(authentication);
        return getProvider(user).getAllEvents(user.getId());
    }

    public List<CalendarEventDto> getUpcomingEvents(Authentication authentication) {
        UserEntity user = getUser(authentication);
        return getProvider(user).getUpcomingEvents(user.getId());
    }

    public List<CalendarEventDto> getEventsInDateRange(
            Authentication authentication,
            String timeMin,
            String timeMax
    ) {
        UserEntity user = getUser(authentication);
        return getProvider(user).getEventsInDateRange(user.getId(), timeMin, timeMax);
    }

    public CalendarEventDto createEvent(Authentication authentication, CalendarEventDto calendarEventDto) {
        UserEntity user = getUser(authentication);
        return getProvider(user).createEvent(user.getId(), calendarEventDto);
    }

    public CalendarEventDto updateEvent(
            Authentication authentication,
            String eventId,
            CalendarEventDto calendarEventDto
    ) {
        UserEntity user = getUser(authentication);
        return getProvider(user).updateEvent(user.getId(), eventId, calendarEventDto);
    }

    public void deleteEvent(Authentication authentication, String eventId) {
        UserEntity user = getUser(authentication);
        getProvider(user).deleteEvent(user.getId(), eventId);
    }

    public CalendarProviderType updateProvider(
            Authentication authentication,
            CalendarProviderType providerType
    ) {
        return userService.updateCalendarProvider(extractCognitoSub(authentication), providerType);
    }

    private UserEntity getUser(Authentication authentication) {
        return userService.getOrCreateUser(extractCognitoSub(authentication));
    }

    private CalendarProvider getProvider(UserEntity user) {
        CalendarProvider provider = providers.get(user.getCalendarProvider());
        if (provider == null) {
            throw new IllegalStateException("Calendar provider is not available: " + user.getCalendarProvider());
        }
        return provider;
    }

    private String extractCognitoSub(Authentication authentication) {
        if (!(authentication instanceof JwtAuthenticationToken jwtAuthenticationToken)) {
            throw new IllegalStateException("Cognito authentication is required");
        }
        return jwtAuthenticationToken.getToken().getClaimAsString("sub");
    }
}
