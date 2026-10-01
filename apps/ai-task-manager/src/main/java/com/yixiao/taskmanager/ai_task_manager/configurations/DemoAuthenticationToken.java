package com.yixiao.taskmanager.ai_task_manager.configurations;

import org.springframework.security.authentication.AbstractAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;

import java.util.List;
import java.util.UUID;

public class DemoAuthenticationToken extends AbstractAuthenticationToken {
    private final UUID sessionId;

    public DemoAuthenticationToken(UUID sessionId) {
        super(List.of(new SimpleGrantedAuthority("ROLE_DEMO")));
        this.sessionId = sessionId;
        setAuthenticated(true);
    }

    @Override
    public Object getCredentials() { return null; }

    @Override
    public Object getPrincipal() { return sessionId; }

    public UUID getSessionId() { return sessionId; }
}
