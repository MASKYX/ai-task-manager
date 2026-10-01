package com.yixiao.taskmanager.ai_task_manager.configurations;

import com.yixiao.taskmanager.ai_task_manager.services.DemoSessionService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.Set;

public class DemoAuthenticationFilter extends OncePerRequestFilter {
    private static final Set<String> SAFE_METHODS = Set.of("GET", "HEAD", "OPTIONS");
    private final DemoSessionService sessions;
    private final String frontendOrigin;

    public DemoAuthenticationFilter(DemoSessionService sessions, String frontendOrigin) {
        this.sessions = sessions;
        this.frontendOrigin = frontendOrigin;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        if (path.startsWith("/api/") && !path.equals("/api/demo/start")
                && request.getHeader("Authorization") == null
                && !(SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken)) {
            Cookie[] cookies = request.getCookies();
            String token = cookies == null ? null : Arrays.stream(cookies)
                    .filter(cookie -> DemoSessionService.COOKIE_NAME.equals(cookie.getName()))
                    .map(Cookie::getValue).findFirst().orElse(null);
            var session = sessions.findValid(token);
            if (session.isPresent()) {
                if (!SAFE_METHODS.contains(request.getMethod())
                        && !frontendOrigin.equals(request.getHeader("Origin"))) {
                    response.sendError(HttpServletResponse.SC_FORBIDDEN);
                    return;
                }
                var context = SecurityContextHolder.createEmptyContext();
                context.setAuthentication(new DemoAuthenticationToken(session.get().getId()));
                SecurityContextHolder.setContext(context);
            }
        }
        chain.doFilter(request, response);
    }
}
