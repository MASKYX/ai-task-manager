package com.yixiao.taskmanager.ai_task_manager.services.calendar;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarEventEntity;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.exception.AgentException;
import com.yixiao.taskmanager.ai_task_manager.repositories.CalendarEventRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.UUID;

@Service
public class LocalCalendarProvider implements CalendarProvider {

    private final CalendarEventRepository calendarEventRepository;

    public LocalCalendarProvider(CalendarEventRepository calendarEventRepository) {
        this.calendarEventRepository = calendarEventRepository;
    }

    @Override
    public CalendarProviderType getType() {
        return CalendarProviderType.LOCAL;
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEventDto> getAllEvents(UUID userId) {
        return calendarEventRepository.findByUserIdOrderByStartDateTimeAsc(userId).stream()
                .map(this::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEventDto> getUpcomingEvents(UUID userId) {
        return calendarEventRepository
                .findTop10ByUserIdAndEndDateTimeGreaterThanOrderByStartDateTimeAsc(
                        userId,
                        OffsetDateTime.now(ZoneOffset.UTC)
                )
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public List<CalendarEventDto> getEventsInDateRange(UUID userId, String timeMin, String timeMax) {
        return calendarEventRepository
                .findByUserIdAndEndDateTimeGreaterThanAndStartDateTimeLessThanOrderByStartDateTimeAsc(
                        userId,
                        parseDateTime(timeMin),
                        parseDateTime(timeMax)
                )
                .stream()
                .map(this::toDto)
                .toList();
    }

    @Override
    @Transactional
    public CalendarEventDto createEvent(UUID userId, CalendarEventDto calendarEventDto) {
        CalendarEventEntity event = new CalendarEventEntity(
                userId,
                calendarEventDto.getSummary(),
                calendarEventDto.getDescription(),
                parseEventDateTime(calendarEventDto.getStartDateTime(), calendarEventDto.isAllDay()),
                parseEventDateTime(calendarEventDto.getEndDateTime(), calendarEventDto.isAllDay()),
                calendarEventDto.isAllDay()
        );

        return toDto(calendarEventRepository.save(event));
    }

    @Override
    @Transactional
    public CalendarEventDto updateEvent(UUID userId, String eventId, CalendarEventDto calendarEventDto) {
        CalendarEventEntity event = findUserEvent(userId, eventId);
        event.update(
                calendarEventDto.getSummary(),
                calendarEventDto.getDescription(),
                parseEventDateTime(calendarEventDto.getStartDateTime(), calendarEventDto.isAllDay()),
                parseEventDateTime(calendarEventDto.getEndDateTime(), calendarEventDto.isAllDay()),
                calendarEventDto.isAllDay()
        );

        return toDto(calendarEventRepository.save(event));
    }

    @Override
    @Transactional
    public void deleteEvent(UUID userId, String eventId) {
        calendarEventRepository.delete(findUserEvent(userId, eventId));
    }

    private CalendarEventEntity findUserEvent(UUID userId, String eventId) {
        UUID id;
        try {
            id = UUID.fromString(eventId);
        } catch (IllegalArgumentException ex) {
            throw new AgentException(HttpStatus.NOT_FOUND, "Spring Boot", "Event not found.");
        }

        return calendarEventRepository.findByIdAndUserId(id, userId)
                .orElseThrow(() -> new AgentException(HttpStatus.NOT_FOUND, "Spring Boot", "Event not found."));
    }

    private CalendarEventDto toDto(CalendarEventEntity event) {
        return CalendarEventDto.builder()
                .id(event.getId().toString())
                .summary(event.getSummary())
                .description(event.getDescription())
                .startDateTime(formatDateTime(event.getStartDateTime(), event.isAllDay()))
                .endDateTime(formatDateTime(event.getEndDateTime(), event.isAllDay()))
                .allDay(event.isAllDay())
                .build();
    }

    private OffsetDateTime parseEventDateTime(String value, boolean allDay) {
        if (!allDay) {
            return parseDateTime(value);
        }

        String date = value != null && value.contains("T")
                ? value.substring(0, value.indexOf('T'))
                : value;
        return LocalDate.parse(date).atStartOfDay().atOffset(ZoneOffset.UTC);
    }

    private OffsetDateTime parseDateTime(String value) {
        try {
            return OffsetDateTime.parse(value);
        } catch (DateTimeParseException ex) {
            return LocalDate.parse(value).atStartOfDay().atOffset(ZoneOffset.UTC);
        }
    }

    private String formatDateTime(OffsetDateTime value, boolean allDay) {
        return allDay ? value.toLocalDate().toString() : value.toString();
    }
}
