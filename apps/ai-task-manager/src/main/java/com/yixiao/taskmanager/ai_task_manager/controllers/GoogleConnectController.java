package com.yixiao.taskmanager.ai_task_manager.controllers;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class GoogleConnectController {

    @GetMapping("/api/google/connect")
    public Map<String, String> connectGoogle(Authentication authentication,
                                             HttpServletRequest request) {

        JwtAuthenticationToken jwtAuthenticationToken = (JwtAuthenticationToken) authentication;
        String cognitoSub = jwtAuthenticationToken.getToken().getClaimAsString("sub");

        HttpSession session = request.getSession(true);
        session.setAttribute("cognitoSub", cognitoSub);

        return Map.of("redirectUrl", "http://localhost:8080/oauth2/authorization/google");
    }
}