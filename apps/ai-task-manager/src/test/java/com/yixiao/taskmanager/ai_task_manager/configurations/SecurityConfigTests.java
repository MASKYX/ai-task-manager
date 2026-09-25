package com.yixiao.taskmanager.ai_task_manager.configurations;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class SecurityConfigTests {
    private static final String ISSUER = "https://cognito-idp.eu-west-1.amazonaws.com/pool";
    private static final String CLIENT = "client-id";
    private final SecurityConfig config = new SecurityConfig();

    private Jwt token(String issuer, String client, String use, Instant expiry) {
        return Jwt.withTokenValue("token").header("alg", "RS256")
                .claim("iss", issuer).claim("sub", "user-123")
                .claim("client_id", client).claim("token_use", use)
                .issuedAt(expiry.minusSeconds(30)).expiresAt(expiry).build();
    }

    @Test
    void acceptsOnlyAccessTokensForExpectedClient() {
        Instant future = Instant.now().plusSeconds(300);
        assertFalse(SecurityConfig.cognitoAccessTokenValidator(CLIENT)
                .validate(token(ISSUER, CLIENT, "access", future)).hasErrors());
        assertTrue(SecurityConfig.cognitoAccessTokenValidator(CLIENT)
                .validate(token(ISSUER, CLIENT, "id", future)).hasErrors());
        assertTrue(SecurityConfig.cognitoAccessTokenValidator(CLIENT)
                .validate(token(ISSUER, "other-client", "access", future)).hasErrors());
    }

    @Test
    void standardValidatorRejectsExpiredAndWrongIssuer() {
        var validator = org.springframework.security.oauth2.jwt.JwtValidators.createDefaultWithIssuer(ISSUER);
        assertTrue(validator.validate(token(ISSUER, CLIENT, "access", Instant.now().minusSeconds(300))).hasErrors());
        assertTrue(validator.validate(token("https://wrong.example", CLIENT, "access",
                Instant.now().plusSeconds(300))).hasErrors());
    }

    @Test
    void malformedJwtIsRejected() {
        assertThrows(JwtException.class, () -> config.jwtDecoder(ISSUER, CLIENT).decode("not-a-jwt"));
    }

    @Test
    void corsAllowsOnlyConfiguredOrigin() {
        CorsConfigurationSource source = config.corsConfigurationSource("https://tasks.example.com");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/calendar/events");
        CorsConfiguration cors = source.getCorsConfiguration(request);
        assertNotNull(cors);
        assertEquals("https://tasks.example.com", cors.checkOrigin("https://tasks.example.com"));
        assertNull(cors.checkOrigin("https://attacker.example"));
        assertFalse(cors.getAllowedHeaders().contains("*"));
    }
}
