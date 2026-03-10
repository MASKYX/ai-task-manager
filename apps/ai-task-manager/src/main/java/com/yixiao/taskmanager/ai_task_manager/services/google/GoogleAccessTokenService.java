package com.yixiao.taskmanager.ai_task_manager.services.google;

import com.yixiao.taskmanager.ai_task_manager.mappers.GoogleTokenMapper;
import com.yixiao.taskmanager.ai_task_manager.mappers.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.UUID;

@Service
public class GoogleAccessTokenService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private GoogleTokenMapper googleTokenMapper;

    public String getAccessToken(Authentication authentication) {
        String cognitoSub = extractCognitoSub(authentication);

        UUID userId = UUID.fromString(userMapper.upsertAndGetId(cognitoSub));

        String accessToken = googleTokenMapper.findActiveAccessTokenByUserId(userId);
        OffsetDateTime expiresAt = googleTokenMapper.findActiveAccessTokenExpiresAtByUserId(userId);

        if (accessToken == null) {
            throw new IllegalStateException("Google account not connected");
        }

        if (expiresAt != null && expiresAt.isBefore(OffsetDateTime.now())) {
            throw new IllegalStateException("Google access token expired");
        }

        return accessToken;
    }

    private String extractCognitoSub(Authentication authentication) {
        JwtAuthenticationToken jwtAuthenticationToken = (JwtAuthenticationToken) authentication;
        return jwtAuthenticationToken.getToken().getClaimAsString("sub");
    }
}