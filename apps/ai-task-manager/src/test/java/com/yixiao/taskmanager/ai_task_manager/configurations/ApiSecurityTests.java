package com.yixiao.taskmanager.ai_task_manager.configurations;

import com.yixiao.taskmanager.ai_task_manager.controllers.AgentController;
import com.yixiao.taskmanager.ai_task_manager.controllers.DemoController;
import com.yixiao.taskmanager.ai_task_manager.entities.DemoSessionEntity;
import com.yixiao.taskmanager.ai_task_manager.services.AgentService;
import com.yixiao.taskmanager.ai_task_manager.services.DemoSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.mock.web.MockCookie;
import org.springframework.security.oauth2.client.registration.ClientRegistrationRepository;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest({AgentController.class, DemoController.class})
@Import(SecurityConfig.class)
@TestPropertySource(properties = {
        "spring.security.oauth2.resourceserver.jwt.issuer-uri=https://cognito-idp.eu-west-1.amazonaws.com/pool",
        "COGNITO_APP_CLIENT_ID=expected-client",
        "app.frontend-origin=https://tasks.example.com"
})
class ApiSecurityTests {
    @Autowired MockMvc mvc;
    @MockitoBean AgentService agentService;
    @MockitoBean DemoSessionService demoSessions;
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

    @Test
    void demoStartSetsSecureCookieOnlyForFrontendOrigin() throws Exception {
        when(demoSessions.canCreateSession(anyString())).thenReturn(true);
        when(demoSessions.start()).thenReturn("secure-token");
        mvc.perform(post("/api/demo/start").header("Origin", "https://tasks.example.com"))
                .andExpect(status().isNoContent())
                .andExpect(header().string("Set-Cookie", org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString("HttpOnly"),
                        org.hamcrest.Matchers.containsString("Secure"),
                        org.hamcrest.Matchers.containsString("SameSite=Lax"),
                        org.hamcrest.Matchers.containsString("Max-Age=3600"))));
        mvc.perform(post("/api/demo/start").header("Origin", "https://attacker.example"))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/demo/start")).andExpect(status().isForbidden());
        verify(demoSessions, times(1)).start();
    }

    @Test
    void validDemoCookieCanReadApiButCannotUseGoogle() throws Exception {
        String token = "a".repeat(43);
        UUID id = UUID.randomUUID();
        when(demoSessions.findValid(token)).thenReturn(Optional.of(
                new DemoSessionEntity(id, UUID.randomUUID(), "hash", Instant.now().plusSeconds(300))));
        mvc.perform(get("/api/agent/quota").cookie(new MockCookie(DemoSessionService.COOKIE_NAME, token)))
                .andExpect(status().isOk());
        mvc.perform(get("/api/google/connect").cookie(new MockCookie(DemoSessionService.COOKIE_NAME, token)))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/agent/plan").cookie(new MockCookie(DemoSessionService.COOKIE_NAME, token)))
                .andExpect(status().isForbidden());
    }

    @Test
    void invalidDemoCookieIsDeniedAndCognitoJwtStillWorks() throws Exception {
        mvc.perform(get("/api/agent/quota").cookie(new MockCookie(DemoSessionService.COOKIE_NAME, "invalid")))
                .andExpect(status().isUnauthorized());
        mvc.perform(get("/api/agent/quota").with(jwt().jwt(jwt -> jwt.subject("cognito-user"))))
                .andExpect(status().isOk());
    }
}
