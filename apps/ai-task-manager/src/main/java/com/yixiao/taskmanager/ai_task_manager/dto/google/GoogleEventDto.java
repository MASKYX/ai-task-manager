package com.yixiao.taskmanager.ai_task_manager.dto.google;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoogleEventDto {

    private String id;
    private String summary;
    private String description;
    private GoogleEventDateTimeDto start;
    private GoogleEventDateTimeDto end;
}