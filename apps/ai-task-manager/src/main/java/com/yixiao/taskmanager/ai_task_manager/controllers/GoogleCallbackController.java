package com.yixiao.taskmanager.ai_task_manager.controllers;

import com.yixiao.taskmanager.ai_task_manager.services.UserService;
import com.yixiao.taskmanager.ai_task_manager.services.google.GoogleOAuthTokenStore;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.client.OAuth2AuthorizeRequest;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClient;
import org.springframework.security.oauth2.client.OAuth2AuthorizedClientManager;
import org.springframework.security.oauth2.core.OAuth2AccessToken;
import org.springframework.security.oauth2.core.OAuth2RefreshToken;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

@Controller
public class GoogleCallbackController {

    @Value("${app.frontend-url:http://localhost:5173/}")
    private String frontendUrl;

    @Autowired
    private OAuth2AuthorizedClientManager authorizedClientManager;

    @Autowired
    private UserService userService;

    @Autowired
    private GoogleOAuthTokenStore googleOAuthTokenStore;

    @GetMapping("/access-granted")
    public String index(Authentication authentication,
                        HttpServletRequest servletRequest,
                        HttpServletResponse servletResponse) {

        OAuth2AuthorizeRequest authorizeRequest = OAuth2AuthorizeRequest.withClientRegistrationId("google")
                .principal(authentication)
                .attributes(attrs -> {
                    attrs.put(HttpServletRequest.class.getName(), servletRequest);
                    attrs.put(HttpServletResponse.class.getName(), servletResponse);
                })
                .build();

        OAuth2AuthorizedClient authorizedClient = authorizedClientManager.authorize(authorizeRequest);

        if (authorizedClient == null || authorizedClient.getAccessToken() == null) {
            throw new IllegalStateException("Could not obtain Google access token");
        }

        OAuth2AccessToken accessToken = authorizedClient.getAccessToken();
        OAuth2RefreshToken refreshToken = authorizedClient.getRefreshToken();

        HttpSession session = servletRequest.getSession(false);
        if (session == null) {
            throw new IllegalStateException("Session not found");
        }

        String cognitoSub = (String) session.getAttribute("cognitoSub");
        if (cognitoSub == null || cognitoSub.isBlank()) {
            throw new IllegalStateException("Cognito sub not found in session");
        }

        session.removeAttribute("cognitoSub");
        UUID userId = userService.getOrCreateUserId(cognitoSub);

        OffsetDateTime expiresAt = accessToken.getExpiresAt() != null
                ? OffsetDateTime.ofInstant(accessToken.getExpiresAt(), ZoneOffset.UTC)
                : null;

        String scope = accessToken.getScopes() != null
                ? String.join(" ", accessToken.getScopes())
                : null;

        googleOAuthTokenStore.upsertTokens(
                userId,
                refreshToken != null ? refreshToken.getTokenValue() : null,
                accessToken.getTokenValue(),
                expiresAt,
                scope
        );

        return "redirect:" + frontendUrl;
    }
}
