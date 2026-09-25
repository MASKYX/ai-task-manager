package com.yixiao.taskmanager.ai_task_manager.controllers;

import com.yixiao.taskmanager.ai_task_manager.dto.AgentDtos.*;
import com.yixiao.taskmanager.ai_task_manager.services.AgentService;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/agent")
public class AgentController {
    private final AgentService agentService;

    public AgentController(AgentService agentService) { this.agentService = agentService; }

    @PostMapping("/plan")
    public PlanResponse plan(Authentication authentication, @RequestBody PlanRequest request) {
        return agentService.plan(authentication, request);
    }

    @GetMapping("/quota")
    public AiQuota quota(Authentication authentication) {
        return agentService.getQuota(authentication);
    }

    @PostMapping("/execute")
    public ExecuteResponse execute(Authentication authentication, @RequestBody ExecuteRequest request) {
        return agentService.execute(authentication, request);
    }
}
