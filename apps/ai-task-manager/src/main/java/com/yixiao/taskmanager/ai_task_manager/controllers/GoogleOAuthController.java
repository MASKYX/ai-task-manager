package com.yixiao.taskmanager.ai_task_manager.controllers;

import com.yixiao.taskmanager.ai_task_manager.mappers.GoogleTokenMapper;
import com.yixiao.taskmanager.ai_task_manager.mappers.UserMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
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
public class GoogleOAuthController {

    @Autowired
    private OAuth2AuthorizedClientManager authorizedClientManager;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private GoogleTokenMapper googleTokenMapper;

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

        UUID userId = UUID.fromString(userMapper.upsertAndGetId(cognitoSub));

        OffsetDateTime expiresAt = accessToken.getExpiresAt() != null
                ? OffsetDateTime.ofInstant(accessToken.getExpiresAt(), ZoneOffset.UTC)
                : null;

        String scope = accessToken.getScopes() != null
                ? String.join(" ", accessToken.getScopes())
                : null;

        googleTokenMapper.upsertTokens(
                userId,
                refreshToken != null ? refreshToken.getTokenValue() : null,
                accessToken.getTokenValue(),
                expiresAt,
                scope
        );

        System.out.println("Google access token saved for user " + userId);

        return "redirect:http://localhost:5173/callback";
    }
}