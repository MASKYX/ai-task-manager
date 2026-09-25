package com.yixiao.taskmanager.ai_task_manager.dto;

import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import java.util.List;

public final class AgentDtos {
    private AgentDtos() {}

    public record ChatMessage(Role role, String content, List<CalendarAction> actions) {
        public enum Role { USER, ASSISTANT }
    }
    public record PlanRequest(String preferences, String request, List<ChatMessage> history) {
        public PlanRequest(String preferences, String request) {
            this(preferences, request, List.of());
        }
    }
    public record TemporalContext(String currentDate, String currentTime, String dayOfWeek, String timezone) {}
    public record CalendarContext(CalendarProviderType provider, List<CalendarEventDto> events, TemporalContext temporal) {}
    public record FastApiRequest(CalendarContext context, String preferences, String request, List<ChatMessage> history) {}
    public record AiQuota(int remaining, int limit) {}
    public record PlanResponse(String comment, List<CalendarAction> actions, AiQuota quota) {}
    public record ExecuteRequest(List<CalendarAction> actions) {}
    public record ActionResult(int index, boolean success, String message) {}
    public record ExecuteResponse(String message, int executed, int failed, List<ActionResult> results) {}
}
