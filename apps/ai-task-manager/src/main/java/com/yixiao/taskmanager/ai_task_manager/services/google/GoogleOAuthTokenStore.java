package com.yixiao.taskmanager.ai_task_manager.services.google;

import com.yixiao.taskmanager.ai_task_manager.entities.GoogleOAuthTokenEntity;
import com.yixiao.taskmanager.ai_task_manager.repositories.GoogleOAuthTokenRepository;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

@Service
public class GoogleOAuthTokenStore {

    private final GoogleOAuthTokenRepository googleOAuthTokenRepository;

    public GoogleOAuthTokenStore(GoogleOAuthTokenRepository googleOAuthTokenRepository) {
        this.googleOAuthTokenRepository = googleOAuthTokenRepository;
    }

    @Transactional(readOnly = true)
    public Optional<GoogleOAuthTokenEntity> findActiveByUserId(UUID userId) {
        return googleOAuthTokenRepository.findByUserIdAndRevokedAtIsNull(userId);
    }

    public void upsertTokens(
            UUID userId,
            String refreshToken,
            String accessToken,
            OffsetDateTime expiresAt,
            String scope
    ) {
        googleOAuthTokenRepository.findById(userId)
                .ifPresentOrElse(
                        token -> updateToken(token, refreshToken, accessToken, expiresAt, scope),
                        () -> createToken(userId, refreshToken, accessToken, expiresAt, scope)
                );
    }

    private void createToken(
            UUID userId,
            String refreshToken,
            String accessToken,
            OffsetDateTime expiresAt,
            String scope
    ) {
        GoogleOAuthTokenEntity token = new GoogleOAuthTokenEntity(userId);
        token.applyTokens(refreshToken, accessToken, expiresAt, scope);

        try {
            googleOAuthTokenRepository.saveAndFlush(token);
        } catch (DataIntegrityViolationException ex) {
            GoogleOAuthTokenEntity existingToken = googleOAuthTokenRepository.findById(userId)
                    .orElseThrow(() -> ex);
            updateToken(existingToken, refreshToken, accessToken, expiresAt, scope);
        }
    }

    private void updateToken(
            GoogleOAuthTokenEntity token,
            String refreshToken,
            String accessToken,
            OffsetDateTime expiresAt,
            String scope
    ) {
        token.applyTokens(refreshToken, accessToken, expiresAt, scope);
        googleOAuthTokenRepository.save(token);
    }

    @Transactional
    public int revokeByUserId(UUID userId) {
        return googleOAuthTokenRepository.findByUserIdAndRevokedAtIsNull(userId)
                .map(token -> {
                    token.revoke();
                    return 1;
                })
                .orElse(0);
    }
}
