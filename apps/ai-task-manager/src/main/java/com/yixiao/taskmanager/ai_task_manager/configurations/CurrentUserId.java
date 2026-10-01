package com.yixiao.taskmanager.ai_task_manager.configurations;

import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

public final class CurrentUserId {
    private CurrentUserId() {}

    public static String get(Authentication authentication) {
        if (authentication instanceof JwtAuthenticationToken jwt) {
            return jwt.getToken().getSubject();
        }
        if (authentication instanceof DemoAuthenticationToken demo) {
            return demo.getSessionId().toString();
        }
        throw new IllegalStateException("Authenticated user is required");
    }

    public static String userKey(Authentication authentication) {
        String id = get(authentication);
        return isDemo(authentication) ? "demo:" + id : id;
    }

    public static boolean isDemo(Authentication authentication) {
        return authentication instanceof DemoAuthenticationToken;
    }
}
