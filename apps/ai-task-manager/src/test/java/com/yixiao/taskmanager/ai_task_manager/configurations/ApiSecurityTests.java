package com.yixiao.taskmanager.ai_task_manager.configurations;

import com.yixiao.taskmanager.ai_task_manager.controllers.AgentController;
import com.yixiao.taskmanager.ai_task_manager.services.AgentService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AgentController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = {
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://cognito-idp.eu-west-1.amazonaws.com/pool",
        "COGNITO_APP_CLIENT_ID=expected-client",
        "app.frontend-origin=https://tasks.example.com"
})
class ApiSecurityTests {
    @Autowired MockMvc mvc;
    @MockitoBean AgentService agentService;
    @MockitoBean ClientRegistrationRepository clientRegistrations;

    @Test
    void unauthenticatedApiRequestIsDenied() throws Exception {
        mvc.perform(get("/api/agent/quota")).andExpect(status().isUnauthorized());
    }

    @Test
    void malformedBearerTokenIsDenied() throws Exception {
        mvc.perform(get("/api/agent/quota").header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unexpectedCorsOriginIsDenied() throws Exception {
        mvc.perform(get("/api/agent/quota").header("Origin", "https://attacker.example"))
                .andExpect(status().isForbidden());
    }
}
