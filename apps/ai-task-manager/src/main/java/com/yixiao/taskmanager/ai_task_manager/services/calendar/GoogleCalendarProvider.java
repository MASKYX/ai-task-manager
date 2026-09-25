package com.yixiao.taskmanager.ai_task_manager.services.calendar;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.services.google.GoogleCalendarService;
import com.yixiao.taskmanager.ai_task_manager.services.google.GoogleTokenService;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class GoogleCalendarProvider implements CalendarProvider {

    private final GoogleTokenService googleTokenService;
    private final GoogleCalendarService googleCalendarService;

    public GoogleCalendarProvider(
            GoogleTokenService googleTokenService,
            GoogleCalendarService googleCalendarService
    ) {
        this.googleTokenService = googleTokenService;
        this.googleCalendarService = googleCalendarService;
    }

    @Override
    public CalendarProviderType getType() {
        return CalendarProviderType.GOOGLE;
    }

    @Override
    public List<CalendarEventDto> getAllEvents(UUID userId) {
        return googleCalendarService.getAllEvents(googleTokenService.getAccessToken(userId));
    }

    @Override
    public List<CalendarEventDto> getUpcomingEvents(UUID userId) {
        return googleCalendarService.getUpcomingEvents(googleTokenService.getAccessToken(userId));
    }

    @Override
    public List<CalendarEventDto> getEventsInDateRange(UUID userId, String timeMin, String timeMax) {
        return googleCalendarService.getEventsInDateRange(
                googleTokenService.getAccessToken(userId),
                timeMin,
                timeMax
        );
    }

    @Override
    public CalendarEventDto createEvent(UUID userId, CalendarEventDto calendarEventDto) {
        return googleCalendarService.createEvent(
                googleTokenService.getAccessToken(userId),
                calendarEventDto
        );
    }

    @Override
    public CalendarEventDto updateEvent(UUID userId, String eventId, CalendarEventDto calendarEventDto) {
        return googleCalendarService.updateEvent(
                googleTokenService.getAccessToken(userId),
                eventId,
                calendarEventDto
        );
    }

    @Override
    public void deleteEvent(UUID userId, String eventId) {
        googleCalendarService.deleteEvent(googleTokenService.getAccessToken(userId), eventId);
    }
}
