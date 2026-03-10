package com.yixiao.taskmanager.ai_task_manager.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CalendarEventDto {

    private String id;
    private String summary;
    private String description;
    private String startDateTime;
    private String endDateTime;
    private boolean allDay;
}