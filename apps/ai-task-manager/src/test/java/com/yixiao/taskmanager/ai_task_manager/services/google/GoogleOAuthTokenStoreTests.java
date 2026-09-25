package com.yixiao.taskmanager.ai_task_manager.services.google;

import com.yixiao.taskmanager.ai_task_manager.entities.GoogleOAuthTokenEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.GoogleOAuthTokenRepository;
import org.junit.jupiter.api.Test;
import org.springframework.web.client.RestClient;

import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class GoogleOAuthTokenStoreTests {
    private static GoogleTokenCipher cipher() {
        return new GoogleTokenCipher(Base64.getEncoder().encodeToString(new byte[32]));
    }

    @Test
    void persistsOnlyEncryptedGoogleCredentials() {
        GoogleOAuthTokenRepository repository = mock(GoogleOAuthTokenRepository.class);
        GoogleTokenCipher cipher = cipher();
        GoogleOAuthTokenStore store = new GoogleOAuthTokenStore(repository, cipher);
        UUID userId = UUID.randomUUID();
        store.upsertTokens(userId, "refresh-secret", "access-secret", OffsetDateTime.now().plusDays(1), "calendar");
        var captor = org.mockito.ArgumentCaptor.forClass(GoogleOAuthTokenEntity.class);
        verify(repository).saveAndFlush(captor.capture());
        assertEquals("refresh-secret", cipher.decrypt(captor.getValue().getRefreshToken()));
        assertEquals("access-secret", cipher.decrypt(captor.getValue().getAccessToken()));
        assertNotEquals("refresh-secret", captor.getValue().getRefreshToken());
    }

    @Test
    void legacyPlaintextIsMigratedOnUse() {
        GoogleOAuthTokenStore store = mock(GoogleOAuthTokenStore.class);
        GoogleTokenCipher cipher = cipher();
        UUID userId = UUID.randomUUID();
        OffsetDateTime expiry = OffsetDateTime.now().plusDays(1);
        GoogleOAuthTokenEntity old = new GoogleOAuthTokenEntity(userId);
        old.applyTokens("old-refresh", "old-access", expiry, "calendar");
        when(store.findActiveByUserId(userId)).thenReturn(Optional.of(old));
        GoogleTokenService service = new GoogleTokenService(RestClient.builder(), store, cipher);
        assertEquals("old-access", service.getAccessToken(userId));
        verify(store).upsertTokens(userId, "old-refresh", "old-access", expiry, "calendar");
    }
}
