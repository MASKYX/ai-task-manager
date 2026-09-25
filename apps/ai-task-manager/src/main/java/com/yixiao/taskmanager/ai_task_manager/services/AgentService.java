package com.yixiao.taskmanager.ai_task_manager.services;

import com.yixiao.taskmanager.ai_task_manager.dto.AgentDtos.*;
import com.yixiao.taskmanager.ai_task_manager.dto.CalendarAction;
import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.exception.AgentException;
import com.yixiao.taskmanager.ai_task_manager.services.calendar.CalendarService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class AgentService {
    private final CalendarService calendarService;
    private final RestClient fastApi;
    private final ObjectMapper mapper;
    private final UserService userService;
    private final Clock clock;

    public AgentService(CalendarService calendarService, UserService userService, RestClient.Builder builder,
                        ObjectMapper mapper, Clock clock,
                        @Value("${agent.fast-api-url:http://localhost:8000}") String fastApiUrl) {
        this.calendarService = calendarService;
        this.userService = userService;
        this.fastApi = builder.baseUrl(fastApiUrl).build();
        this.mapper = mapper.rebuild().enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES).build();
        this.clock = clock;
    }

    public PlanResponse plan(Authentication authentication, PlanRequest request) {
        if (request == null || blank(request.request())) {
            throw new AgentException(HttpStatus.BAD_REQUEST, "Spring Boot", "Enter a request for My Bot.");
        }
        FastApiRequest payload;
        try {
            List<ChatMessage> history = request.history() == null ? List.of() : request.history();
            if (history.size() > 40 || history.stream().anyMatch(message -> message == null
                    || message.role() == null || blank(message.content()))) {
                throw new AgentException(HttpStatus.BAD_REQUEST, "Spring Boot", "Invalid conversation history.");
            }
            ZonedDateTime now = ZonedDateTime.now(clock);
            TemporalContext temporal = new TemporalContext(now.toLocalDate().toString(),
                    now.toOffsetDateTime().toOffsetTime().toString(), now.getDayOfWeek().name(), now.getZone().getId());
            payload = new FastApiRequest(new CalendarContext(calendarService.getProviderType(authentication),
                    calendarService.getAllEvents(authentication), temporal), request.preferences(), request.request(), history);
        } catch (AgentException ex) {
            throw ex;
        } catch (RuntimeException ex) {
            throw new AgentException(HttpStatus.BAD_GATEWAY, "calendar provider", "Could not read your calendar.");
        }
        UserService.QuotaConsumption consumption = userService.consumeAiRequest(authentication.getName());
        if (!consumption.allowed()) {
            throw new AgentException(HttpStatus.TOO_MANY_REQUESTS, "Spring Boot", "DAILY_AI_LIMIT_REACHED",
                    "Daily AI request limit reached. Requests will be available again after the daily reset.");
        }
        String json;
        try {
            json = fastApi.post().uri("/plan").body(payload).retrieve().body(String.class);
        } catch (RestClientResponseException ex) {
            if (ex.getStatusCode().value() == 503) {
                throw new AgentException(HttpStatus.SERVICE_UNAVAILABLE, "AI provider",
                        "The AI provider is busy. Please try again shortly.");
            }
            throw new AgentException(HttpStatus.BAD_GATEWAY, "FastAPI", "My Bot is unavailable. Please try again.");
        } catch (RestClientException ex) {
            throw new AgentException(HttpStatus.BAD_GATEWAY, "FastAPI", "My Bot is unavailable. Please try again.");
        }
        try {
            PlanResponse response = mapper.readValue(json, PlanResponse.class);
            if (response == null || blank(response.comment()) || response.actions() == null) {
                throw new IllegalArgumentException("Incomplete AI response");
            }
            validateActions(response.actions(), payload.context().events());
            return new PlanResponse(response.comment(), response.actions(), consumption.quota());
        } catch (Exception ex) {
            throw new AgentException(HttpStatus.BAD_GATEWAY, "AI response processing",
                    "My Bot returned an invalid proposal. Please try again.");
        }
    }

    public AiQuota getQuota(Authentication authentication) {
        return userService.getAiQuota(authentication.getName());
    }

    public ExecuteResponse execute(Authentication authentication, ExecuteRequest request) {
        if (request == null || request.actions() == null || request.actions().isEmpty()) {
            throw new AgentException(HttpStatus.BAD_REQUEST, "Spring Boot", "Select at least one calendar action.");
        }
        List<CalendarEventDto> events;
        try {
            events = calendarService.getAllEvents(authentication);
        } catch (RuntimeException ex) {
            throw new AgentException(HttpStatus.BAD_GATEWAY, "calendar provider", "Could not validate your calendar.");
        }
        validateActions(request.actions(), events);
        List<ActionResult> results = new ArrayList<>();
        int executed = 0;
        for (int index = 0; index < request.actions().size(); index++) {
            CalendarAction action = request.actions().get(index);
            try {
                switch (action.type()) {
                    case CREATE_EVENT -> calendarService.createEvent(authentication, action.event());
                    case UPDATE_EVENT -> calendarService.updateEvent(authentication, action.eventId(), action.event());
                    case DELETE_EVENT -> calendarService.deleteEvent(authentication, action.eventId());
                }
                results.add(new ActionResult(index, true, "Applied."));
                executed++;
            } catch (RuntimeException ex) {
                results.add(new ActionResult(index, false,
                        "The calendar provider could not apply this change. The event may have changed."));
            }
        }
        int failed = results.size() - executed;
        String message = failed == 0 ? "All calendar changes were applied."
                : executed == 0 ? "No calendar changes could be applied."
                : "Some calendar changes were applied; others failed.";
        return new ExecuteResponse(message, executed, failed, results);
    }

    private void validateActions(List<CalendarAction> actions, List<CalendarEventDto> events) {
        Set<String> knownIds = new HashSet<>();
        events.forEach(event -> knownIds.add(event.getId()));
        for (CalendarAction action : actions) {
            if (action == null || action.type() == null) {
                invalid();
            }
            if (action.type() == CalendarAction.Type.CREATE_EVENT) {
                if (!blank(action.eventId())) invalid();
            } else {
                if (blank(action.eventId()) || !knownIds.contains(action.eventId())) invalid();
            }
            if (action.type() == CalendarAction.Type.DELETE_EVENT) {
                if (action.summary() != null || action.description() != null || action.startDateTime() != null
                        || action.endDateTime() != null || action.allDay() != null) invalid();
            } else {
                if (blank(action.summary()) || blank(action.startDateTime()) || blank(action.endDateTime())
                        || action.allDay() == null) invalid();
                try {
                    if (action.allDay()) {
                        LocalDate start = LocalDate.parse(action.startDateTime());
                        LocalDate end = LocalDate.parse(action.endDateTime());
                        if (!end.isAfter(start)) invalid();
                    } else {
                        OffsetDateTime start = OffsetDateTime.parse(action.startDateTime());
                        OffsetDateTime end = OffsetDateTime.parse(action.endDateTime());
                        if (!end.toInstant().isAfter(start.toInstant())) invalid();
                    }
                } catch (RuntimeException ex) {
                    invalid();
                }
            }
        }
    }

    private static boolean blank(String value) { return value == null || value.isBlank(); }

    private static void invalid() {
        throw new AgentException(HttpStatus.BAD_REQUEST, "Spring Boot", "The proposed calendar actions are invalid or outdated.");
    }
}
