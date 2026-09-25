package com.yixiao.taskmanager.ai_task_manager.dto;

public record CalendarAction(Type type, String eventId, String summary, String description,
                             String startDateTime, String endDateTime, Boolean allDay) {
    public enum Type { CREATE_EVENT, UPDATE_EVENT, DELETE_EVENT }

    public CalendarEventDto event() {
        return CalendarEventDto.builder().summary(summary).description(description)
                .startDateTime(startDateTime).endDateTime(endDateTime)
                .allDay(Boolean.TRUE.equals(allDay)).build();
    }
}
