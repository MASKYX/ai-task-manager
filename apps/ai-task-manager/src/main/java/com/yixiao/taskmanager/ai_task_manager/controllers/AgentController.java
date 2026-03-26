package com.yixiao.taskmanager.ai_task_manager.controllers;

import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.client.RestTemplate;

@RestController
@RequestMapping("/api/agent")
public class AgentController {

    RestTemplate restTemplate = new RestTemplate();

}
