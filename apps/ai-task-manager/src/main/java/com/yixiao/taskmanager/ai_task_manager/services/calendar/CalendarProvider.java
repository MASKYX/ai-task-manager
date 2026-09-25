package com.yixiao.taskmanager.ai_task_manager.services.calendar;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;

import java.util.List;
import java.util.UUID;

public interface CalendarProvider {

    CalendarProviderType getType();

    List<CalendarEventDto> getAllEvents(UUID userId);

    List<CalendarEventDto> getUpcomingEvents(UUID userId);

    List<CalendarEventDto> getEventsInDateRange(UUID userId, String timeMin, String timeMax);

    CalendarEventDto createEvent(UUID userId, CalendarEventDto calendarEventDto);

    CalendarEventDto updateEvent(UUID userId, String eventId, CalendarEventDto calendarEventDto);

    void deleteEvent(UUID userId, String eventId);
}
