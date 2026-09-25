package com.yixiao.taskmanager.ai_task_manager;

import com.yixiao.taskmanager.ai_task_manager.controllers.AgentController;
import com.yixiao.taskmanager.ai_task_manager.dto.AgentDtos.AiQuota;
import com.yixiao.taskmanager.ai_task_manager.services.AgentService;
import org.junit.jupiter.api.Test;
import org.springframework.security.core.Authentication;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.*;

class AgentControllerTests {
    @Test
    void quotaEndpointUsesAuthenticatedUser() {
        AgentService service = mock(AgentService.class);
        Authentication authentication = mock(Authentication.class);
        when(service.getQuota(authentication)).thenReturn(new AiQuota(17, 20));

        AiQuota quota = new AgentController(service).quota(authentication);

        assertEquals(new AiQuota(17, 20), quota);
        verify(service).getQuota(authentication);
    }
}
