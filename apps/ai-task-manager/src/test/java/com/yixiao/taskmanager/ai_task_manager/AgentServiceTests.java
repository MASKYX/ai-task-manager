package com.yixiao.taskmanager.ai_task_manager;

import com.yixiao.taskmanager.ai_task_manager.dto.AgentDtos.*;
import com.yixiao.taskmanager.ai_task_manager.dto.CalendarAction;
import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.exception.AgentException;
import com.yixiao.taskmanager.ai_task_manager.services.AgentService;
import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import com.yixiao.taskmanager.ai_task_manager.services.calendar.CalendarService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.ObjectMapper;

import java.util.List;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

class AgentServiceTests {
    private CalendarService calendar;
    private AgentService agent;
    private MockRestServiceServer server;
    private Authentication authentication;
    private UserService users;
    private Clock clock;

    @BeforeEach
    void setUp() {
        calendar = mock(CalendarService.class);
        users = mock(UserService.class);
        authentication = mock(Authentication.class);
        clock = Clock.fixed(Instant.parse("2026-09-23T12:30:00Z"), ZoneId.of("Europe/Madrid"));
        RestClient.Builder builder = RestClient.builder();
        server = MockRestServiceServer.bindTo(builder).build();
        agent = new AgentService(calendar, users, builder, new ObjectMapper(), clock, "http://localhost:8000");
        when(authentication.getName()).thenReturn("user-1");
        when(users.consumeAiRequest("user-1"))
                .thenReturn(new UserService.QuotaConsumption(true, new AiQuota(19, 20)));
        when(calendar.getProviderType(authentication)).thenReturn(CalendarProviderType.LOCAL);
        when(calendar.getAllEvents(authentication)).thenReturn(List.of());
    }

    @Test
    void planWithActions() {
        server.expect(requestTo("http://localhost:8000/plan"))
                .andRespond(withSuccess("{\"comment\":\"Confirm this.\",\"actions\":[{\"type\":\"CREATE_EVENT\",\"summary\":\"Gym\",\"startDateTime\":\"2026-09-22\",\"endDateTime\":\"2026-09-23\",\"allDay\":true}]}", MediaType.APPLICATION_JSON));
        PlanResponse result = agent.plan(authentication, new PlanRequest("mornings", "Add gym"));
        assertEquals("Confirm this.", result.comment());
        assertEquals(1, result.actions().size());
        server.verify();
    }

    @Test
    void googlePlanAcceptsMultipleActions() {
        when(calendar.getProviderType(authentication)).thenReturn(CalendarProviderType.GOOGLE);
        String action = "{\"type\":\"CREATE_EVENT\",\"summary\":\"Gym\",\"startDateTime\":\"2026-09-22\",\"endDateTime\":\"2026-09-23\",\"allDay\":true}";
        server.expect(requestTo("http://localhost:8000/plan"))
                .andRespond(withSuccess("{\"comment\":\"Confirm these.\",\"actions\":[" + action + "," + action + "]}",
                        MediaType.APPLICATION_JSON));
        assertEquals(2, agent.plan(authentication, new PlanRequest("", "Add two events")).actions().size());
    }

    @Test
    void planWithCommentOnly() {
        server.expect(requestTo("http://localhost:8000/plan"))
                .andRespond(withSuccess("{\"comment\":\"Your calendar is clear.\",\"actions\":[]}", MediaType.APPLICATION_JSON));
        assertTrue(agent.plan(authentication, new PlanRequest("", "What is next?")).actions().isEmpty());
        server.verify();
    }

    @Test
    void forwardsConversationHistoryToFastApi() {
        server.expect(requestTo("http://localhost:8000/plan"))
                .andExpect(jsonPath("$.history[0].role").value("USER"))
                .andExpect(jsonPath("$.history[0].content").value("Earlier request"))
                .andRespond(withSuccess("{\"comment\":\"Follow-up received.\",\"actions\":[]}", MediaType.APPLICATION_JSON));
        PlanRequest request = new PlanRequest("mornings", "Follow up",
                List.of(new ChatMessage(ChatMessage.Role.USER, "Earlier request", List.of())));
        assertEquals("Follow-up received.", agent.plan(authentication, request).comment());
        server.verify();
    }

    @Test
    void forwardsConfiguredCurrentTimeToFastApi() {
        server.expect(requestTo("http://localhost:8000/plan"))
                .andExpect(jsonPath("$.context.temporal.currentDate").value("2026-09-23"))
                .andExpect(jsonPath("$.context.temporal.currentTime").value("14:30+02:00"))
                .andExpect(jsonPath("$.context.temporal.dayOfWeek").value("WEDNESDAY"))
                .andExpect(jsonPath("$.context.temporal.timezone").value("Europe/Madrid"))
                .andRespond(withSuccess("{\"comment\":\"Today.\",\"actions\":[]}", MediaType.APPLICATION_JSON));
        PlanResponse response = agent.plan(authentication, new PlanRequest("", "What do I have today?"));
        assertEquals(19, response.quota().remaining());
        server.verify();
    }

    @Test
    void exhaustedQuotaDoesNotCallFastApi() {
        when(users.consumeAiRequest("user-1"))
                .thenReturn(new UserService.QuotaConsumption(false, new AiQuota(0, 20)));
        AgentException error = assertThrows(AgentException.class,
                () -> agent.plan(authentication, new PlanRequest("", "Plan my day")));
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.getStatus());
        assertEquals("DAILY_AI_LIMIT_REACHED", error.getCode());
        server.verify();
    }

    @Test
    void invalidAndUnavailableFastApiResponsesAreDistinguished() {
        server.expect(requestTo("http://localhost:8000/plan"))
                .andRespond(withSuccess("{\"comment\":\"Bad\",\"actions\":[{\"type\":\"UNKNOWN\"}]}", MediaType.APPLICATION_JSON));
        AgentException invalid = assertThrows(AgentException.class,
                () -> agent.plan(authentication, new PlanRequest("", "Plan")));
        assertEquals("AI response processing", invalid.getLayer());
        server.verify();

        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer unavailableServer = MockRestServiceServer.bindTo(builder).build();
        AgentService unavailableAgent = new AgentService(calendar, users, builder, new ObjectMapper(), clock,
                "http://localhost:8000");
        unavailableServer.expect(requestTo("http://localhost:8000/plan")).andRespond(withServerError());
        AgentException unavailable = assertThrows(AgentException.class,
                () -> unavailableAgent.plan(authentication, new PlanRequest("", "Plan")));
        assertEquals("FastAPI", unavailable.getLayer());
    }

    @Test
    void busyAiProviderIsReportedClearly() {
        server.expect(requestTo("http://localhost:8000/plan"))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE));
        AgentException error = assertThrows(AgentException.class,
                () -> agent.plan(authentication, new PlanRequest("", "Plan")));
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatus());
        assertEquals("AI provider", error.getLayer());
        assertTrue(error.getMessage().contains("busy"));
    }

    @Test
    void executionValidatesEntireListBeforeChangingCalendar() {
        CalendarAction valid = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null, "Gym", null,
                "2026-09-22", "2026-09-23", true);
        CalendarAction invalid = new CalendarAction(CalendarAction.Type.DELETE_EVENT, "missing", null, null,
                null, null, null);
        assertThrows(AgentException.class,
                () -> agent.execute(authentication, new ExecuteRequest(List.of(valid, invalid))));
        verify(calendar, never()).createEvent(any(), any());
    }

    @Test
    void successfulExecutionAndProviderFailure() {
        CalendarAction first = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null, "Gym", null,
                "2026-09-22", "2026-09-23", true);
        assertEquals(1, agent.execute(authentication, new ExecuteRequest(List.of(first))).executed());
        verify(calendar).createEvent(eq(authentication), any(CalendarEventDto.class));
        doThrow(new IllegalStateException("provider failure")).when(calendar).createEvent(eq(authentication), any());
        ExecuteResponse failure = agent.execute(authentication, new ExecuteRequest(List.of(first)));
        assertEquals(0, failure.executed());
        assertEquals(1, failure.failed());
        assertFalse(failure.results().getFirst().success());
    }

    @Test
    void laterActionsContinueAfterOneFails() {
        CalendarAction first = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null, "Gym", null,
                "2026-09-22", "2026-09-23", true);
        CalendarAction second = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null, "Study", null,
                "2026-09-24", "2026-09-25", true);
        CalendarAction third = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null, "Walk", null,
                "2026-09-26", "2026-09-27", true);
        when(calendar.createEvent(eq(authentication), any()))
                .thenReturn(CalendarEventDto.builder().build())
                .thenThrow(new IllegalStateException("provider failed"))
                .thenReturn(CalendarEventDto.builder().build());
        ExecuteResponse result = agent.execute(authentication, new ExecuteRequest(List.of(first, second, third)));
        assertEquals(2, result.executed());
        assertEquals(1, result.failed());
        assertEquals(List.of(true, false, true), result.results().stream().map(ActionResult::success).toList());
        verify(calendar, times(3)).createEvent(eq(authentication), any());
    }

    @Test
    void googleExecutesMultiActionBatch() {
        when(calendar.getProviderType(authentication)).thenReturn(CalendarProviderType.GOOGLE);
        CalendarAction action = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null, "Gym", null,
                "2026-09-22", "2026-09-23", true);
        ExecuteResponse result = agent.execute(authentication, new ExecuteRequest(List.of(action, action)));
        assertEquals(2, result.executed());
        verify(calendar, times(2)).createEvent(any(), any());
    }

    @Test
    void oversizedPromptIsRejectedBeforeQuotaOrAiCall() {
        assertThrows(AgentException.class,
                () -> agent.plan(authentication, new PlanRequest("", "x".repeat(4001))));
        verify(users, never()).consumeAiRequest(any());
        server.verify();
    }

    @Test
    void oversizedActionIsRejectedBeforeCalendarMutation() {
        CalendarAction oversized = new CalendarAction(CalendarAction.Type.CREATE_EVENT, null,
                "x".repeat(256), null, "2026-09-22", "2026-09-23", true);
        assertThrows(AgentException.class,
                () -> agent.execute(authentication, new ExecuteRequest(List.of(oversized))));
        verify(calendar, never()).createEvent(any(), any());
    }

    @Test
    void aiCommentIsDataAndCannotTriggerCalendarMutation() {
        String comment = "<script>alert('xss')</script>";
        server.expect(requestTo("http://localhost:8000/plan"))
                .andRespond(withSuccess("{\"comment\":\"<script>alert('xss')</script>\",\"actions\":[]}",
                        MediaType.APPLICATION_JSON));
        assertEquals(comment, agent.plan(authentication, new PlanRequest("", "Plan")).comment());
        verify(calendar, never()).createEvent(any(), any());
    }
}
