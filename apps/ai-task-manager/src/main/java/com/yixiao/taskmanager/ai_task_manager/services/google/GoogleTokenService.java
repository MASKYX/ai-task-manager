package com.yixiao.taskmanager.ai_task_manager.services.google;

import com.yixiao.taskmanager.ai_task_manager.mappers.GoogleTokenMapper;
import com.yixiao.taskmanager.ai_task_manager.mappers.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;

@Service
public class GoogleTokenService {

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private GoogleTokenMapper googleTokenMapper;

    private final RestClient restClient;

    @Value("${spring.security.oauth2.client.registration.google.client-id}")
    private String clientId;

    @Value("${spring.security.oauth2.client.registration.google.client-secret}")
    private String clientSecret;

    public GoogleTokenService(RestClient.Builder restClientBuilder) {
        this.restClient = restClientBuilder
                .baseUrl("https://oauth2.googleapis.com")
                .build();
    }

    public String getAccessToken(Authentication authentication) {
        String cognitoSub = extractCognitoSub(authentication);

        UUID userId = UUID.fromString(userMapper.upsertAndGetId(cognitoSub));

        String accessToken = googleTokenMapper.findActiveAccessTokenByUserId(userId);
        OffsetDateTime expiresAt = googleTokenMapper.findActiveAccessTokenExpiresAtByUserId(userId);

        if (accessToken == null || (expiresAt != null && expiresAt.isBefore(OffsetDateTime.now()))) {
            String refreshToken = googleTokenMapper.findActiveRefreshTokenByUserId(userId);
            accessToken = refreshAccessToken(userId, refreshToken);
        }

        return accessToken;
    }

    private String refreshAccessToken(UUID userId, String refreshToken) {
        MultiValueMap<String, String> form = new LinkedMultiValueMap<>();
        form.add("client_id", clientId);
        form.add("client_secret", clientSecret);
        form.add("refresh_token", refreshToken);
        form.add("grant_type", "refresh_token");

        Map<String, Object> response = restClient.post()
                .uri("/token")
                .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                .body(form)
                .retrieve()
                .body(Map.class);

        if (response == null || response.get("access_token") == null || response.get("expires_in") == null) {
            throw new IllegalStateException("Failed to refresh Google access token");
        }

        String newAccessToken = (String) response.get("access_token");
        Number expiresIn = (Number) response.get("expires_in");
        OffsetDateTime newExpiresAt = OffsetDateTime.now().plusSeconds(expiresIn.longValue());

        googleTokenMapper.upsertTokens(
                userId,
                refreshToken,
                newAccessToken,
                newExpiresAt,
                null
        );

        return newAccessToken;
    }

    private String extractCognitoSub(Authentication authentication) {
        JwtAuthenticationToken jwtAuthenticationToken = (JwtAuthenticationToken) authentication;
        return jwtAuthenticationToken.getToken().getClaimAsString("sub");
    }
}