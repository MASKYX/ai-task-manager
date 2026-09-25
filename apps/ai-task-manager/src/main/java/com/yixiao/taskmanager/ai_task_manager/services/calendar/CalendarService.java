package com.yixiao.taskmanager.ai_task_manager.services.calendar;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.entities.UserEntity;
import com.yixiao.taskmanager.ai_task_manager.exception.AgentException;
import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;
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
        try {
            OffsetDateTime min = OffsetDateTime.parse(timeMin);
            OffsetDateTime max = OffsetDateTime.parse(timeMax);
            if (!max.isAfter(min) || ChronoUnit.DAYS.between(min, max) > 1100) invalidRequest();
        } catch (RuntimeException ex) {
            invalidRequest();
        }
        UserEntity user = getUser(authentication);
        return getProvider(user).getEventsInDateRange(user.getId(), timeMin, timeMax);
    }

    public CalendarEventDto createEvent(Authentication authentication, CalendarEventDto calendarEventDto) {
        validateEvent(calendarEventDto);
        UserEntity user = getUser(authentication);
        return getProvider(user).createEvent(user.getId(), calendarEventDto);
    }

    public CalendarEventDto updateEvent(
            Authentication authentication,
            String eventId,
            CalendarEventDto calendarEventDto
    ) {
        validateEventId(eventId);
        validateEvent(calendarEventDto);
        UserEntity user = getUser(authentication);
        return getProvider(user).updateEvent(user.getId(), eventId, calendarEventDto);
    }

    public void deleteEvent(Authentication authentication, String eventId) {
        validateEventId(eventId);
        UserEntity user = getUser(authentication);
        getProvider(user).deleteEvent(user.getId(), eventId);
    }

    public CalendarProviderType updateProvider(
            Authentication authentication,
            CalendarProviderType providerType
    ) {
        return userService.updateCalendarProvider(extractCognitoSub(authentication), providerType);
    }

    private static void validateEvent(CalendarEventDto event) {
        if (event == null || event.getSummary() == null || event.getSummary().isBlank()
                || event.getSummary().length() > 255
                || (event.getDescription() != null && event.getDescription().length() > 10000)) invalidRequest();
        try {
            if (event.isAllDay()) {
                if (!LocalDate.parse(event.getEndDateTime()).isAfter(LocalDate.parse(event.getStartDateTime()))) invalidRequest();
            } else if (!OffsetDateTime.parse(event.getEndDateTime()).toInstant()
                    .isAfter(OffsetDateTime.parse(event.getStartDateTime()).toInstant())) invalidRequest();
        } catch (RuntimeException ex) {
            invalidRequest();
        }
    }

    private static void validateEventId(String eventId) {
        if (eventId == null || eventId.isBlank() || eventId.length() > 1024
                || eventId.chars().anyMatch(Character::isISOControl)) invalidRequest();
    }

    private static void invalidRequest() {
        throw new AgentException(HttpStatus.BAD_REQUEST, "Spring Boot", "Invalid calendar event or date range.");
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
