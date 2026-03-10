package com.yixiao.taskmanager.ai_task_manager.dto.google;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GoogleEventsResponse {

    private List<GoogleEventDto> items;
}