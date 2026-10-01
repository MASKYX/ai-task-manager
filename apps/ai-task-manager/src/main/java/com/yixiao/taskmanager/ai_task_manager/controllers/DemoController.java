package com.yixiao.taskmanager.ai_task_manager.controllers;

import com.yixiao.taskmanager.ai_task_manager.configurations.DemoAuthenticationToken;
import com.yixiao.taskmanager.ai_task_manager.exception.AgentException;
import com.yixiao.taskmanager.ai_task_manager.services.DemoSessionService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

@RestController
@RequestMapping("/api/demo")
public class DemoController {
    private final DemoSessionService sessions;
    private final String frontendOrigin;

    public DemoController(DemoSessionService sessions,
                          @Value("${app.frontend-origin:http://localhost:5173}") String frontendOrigin) {
        this.sessions = sessions;
        this.frontendOrigin = frontendOrigin;
    }

    @PostMapping("/start")
    public ResponseEntity<Void> start(HttpServletRequest request) {
        requireFrontendOrigin(request.getHeader("Origin"));
        if (!sessions.canCreateSession(clientIp(request))) {
            throw new AgentException(HttpStatus.TOO_MANY_REQUESTS, "Spring Boot",
                    "DEMO_SESSION_LIMIT_REACHED", "Demo limit reached for your IP today. Please try again tomorrow.");
        }
        String token = sessions.start();
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie(token, Duration.ofHours(1))).build();
    }

    @GetMapping("/session")
    public ResponseEntity<Void> session(Authentication authentication) {
        if (!(authentication instanceof DemoAuthenticationToken)) throw new AgentException(HttpStatus.FORBIDDEN, "Spring Boot", "Demo session required.");
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/end")
    public ResponseEntity<Void> end(@RequestHeader(value = "Origin", required = false) String origin,
                                    @CookieValue(value = DemoSessionService.COOKIE_NAME, required = false) String token) {
        requireFrontendOrigin(origin);
        sessions.end(token);
        return ResponseEntity.noContent().header(HttpHeaders.SET_COOKIE, cookie("", Duration.ZERO)).build();
    }

    private String clientIp(HttpServletRequest request) {
        String cloudflareIp = request.getHeader("CF-Connecting-IP");
        if (cloudflareIp != null && !cloudflareIp.isBlank()) return cloudflareIp.trim();

        String forwardedFor = request.getHeader("X-Forwarded-For");
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            String[] addresses = forwardedFor.split(",");
            String proxyAppendedIp = addresses[addresses.length - 1].trim();
            if (!proxyAppendedIp.isBlank()) return proxyAppendedIp;
        }
        return request.getRemoteAddr();
    }

    private void requireFrontendOrigin(String origin) {
        if (!frontendOrigin.equals(origin)) throw new AgentException(HttpStatus.FORBIDDEN, "Spring Boot", "Forbidden.");
    }

    private String cookie(String value, Duration maxAge) {
        return ResponseCookie.from(DemoSessionService.COOKIE_NAME, value)
                .httpOnly(true).secure(true).sameSite("Lax").path("/api").maxAge(maxAge).build().toString();
    }
}
