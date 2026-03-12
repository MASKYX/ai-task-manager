package com.yixiao.taskmanager.ai_task_manager.services.google;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.dto.google.GoogleEventDateTimeDto;
import com.yixiao.taskmanager.ai_task_manager.dto.google.GoogleEventDto;
import com.yixiao.taskmanager.ai_task_manager.dto.google.GoogleEventsResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Service
public class GoogleCalendarService {

    private static final String BASE_URL = "https://www.googleapis.com/calendar/v3";
    private static final String PRIMARY_CALENDAR = "primary";

    private final RestClient restClient;

    public GoogleCalendarService(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder
                .baseUrl(BASE_URL)
                .build();
    }

    public List<CalendarEventDto> getUpcomingEvents(String accessToken) {
        String now = OffsetDateTime.now(ZoneOffset.UTC)
                .withNano(0)
                .toString();
        GoogleEventsResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/calendars/{calendarId}/events")
                        .queryParam("maxResults", 10)
                        .queryParam("singleEvents", true)
                        .queryParam("orderBy", "startTime")
                        .queryParam("timeMin", now)
                        .build(PRIMARY_CALENDAR))
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .body(GoogleEventsResponse.class);

        if (response == null || response.getItems() == null) {
            return List.of();
        }

        return response.getItems().stream()
                .map(this::mapToCalendarEventDto)
                .toList();
    }

    public List<CalendarEventDto> getEventsInDateRange(String accessToken, String timeMin, String timeMax) {
        GoogleEventsResponse response = restClient.get()
                .uri(uriBuilder -> uriBuilder
                        .path("/calendars/{calendarId}/events")
                        .queryParam("singleEvents", true)
                        .queryParam("orderBy", "startTime")
                        .queryParam("timeMin", timeMin)
                        .queryParam("timeMax", timeMax)
                        .build(PRIMARY_CALENDAR))
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .body(GoogleEventsResponse.class);

        if (response == null || response.getItems() == null) {
            return List.of();
        }

        return response.getItems().stream()
                .map(this::mapToCalendarEventDto)
                .toList();
    }

    public CalendarEventDto createEvent(String accessToken, CalendarEventDto calendarEventDto) {
        Map<String, Object> requestBody = buildGoogleEventRequestBody(calendarEventDto);

        GoogleEventDto createdEvent = restClient.post()
                .uri("/calendars/{calendarId}/events", PRIMARY_CALENDAR)
                .headers(headers -> headers.setBearerAuth(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(GoogleEventDto.class);

        if (createdEvent == null) {
            throw new IllegalStateException("Google Calendar returned an empty response when creating the event");
        }

        return mapToCalendarEventDto(createdEvent);
    }

    public CalendarEventDto updateEvent(String accessToken, String eventId, CalendarEventDto calendarEventDto) {
        Map<String, Object> requestBody = buildGoogleEventRequestBody(calendarEventDto);

        GoogleEventDto updatedEvent = restClient.put()
                .uri("/calendars/{calendarId}/events/{eventId}", PRIMARY_CALENDAR, eventId)
                .headers(headers -> headers.setBearerAuth(accessToken))
                .contentType(MediaType.APPLICATION_JSON)
                .body(requestBody)
                .retrieve()
                .body(GoogleEventDto.class);

        if (updatedEvent == null) {
            throw new IllegalStateException("Google Calendar returned an empty response when updating the event");
        }

        return mapToCalendarEventDto(updatedEvent);
    }

    public void deleteEvent(String accessToken, String eventId) {
        restClient.delete()
                .uri("/calendars/{calendarId}/events/{eventId}", PRIMARY_CALENDAR, eventId)
                .headers(headers -> headers.setBearerAuth(accessToken))
                .retrieve()
                .toBodilessEntity();
    }

    private CalendarEventDto mapToCalendarEventDto(GoogleEventDto googleEventDto) {
        boolean allDay = googleEventDto.getStart() != null
                && googleEventDto.getStart().getDate() != null;

        return CalendarEventDto.builder()
                .id(googleEventDto.getId())
                .summary(googleEventDto.getSummary())
                .description(googleEventDto.getDescription())
                .startDateTime(extractDateValue(googleEventDto.getStart()))
                .endDateTime(extractDateValue(googleEventDto.getEnd()))
                .allDay(allDay)
                .build();
    }

    private String extractDateValue(GoogleEventDateTimeDto dateTimeDto) {
        if (dateTimeDto == null) {
            return null;
        }

        if (dateTimeDto.getDateTime() != null) {
            return dateTimeDto.getDateTime();
        }

        return dateTimeDto.getDate();
    }

    private Map<String, Object> buildGoogleEventRequestBody(CalendarEventDto calendarEventDto) {
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("summary", calendarEventDto.getSummary());
        requestBody.put("description", calendarEventDto.getDescription());

        Map<String, String> start = new HashMap<>();
        Map<String, String> end = new HashMap<>();

        if (calendarEventDto.isAllDay()) {
            start.put("date", extractDateOnly(calendarEventDto.getStartDateTime()));
            end.put("date", extractDateOnly(calendarEventDto.getEndDateTime()));
        } else {
            start.put("dateTime", calendarEventDto.getStartDateTime());
            end.put("dateTime", calendarEventDto.getEndDateTime());
        }

        requestBody.put("start", start);
        requestBody.put("end", end);

        return requestBody;
    }

    private String extractDateOnly(String value) {
        if (value == null) {
            return null;
        }

        int tIndex = value.indexOf('T');
        if (tIndex > 0) {
            return value.substring(0, tIndex);
        }

        return value;
    }
}