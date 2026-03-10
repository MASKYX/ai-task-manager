package com.yixiao.taskmanager.ai_task_manager.mappers;

import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.time.OffsetDateTime;
import java.util.UUID;

@Mapper
public interface GoogleTokenMapper {

    /**
     * Minimal read to decide if the user has already connected Google.
     * (Returns refresh_token or null if not found / revoked.)
     */
    @Select("""
        SELECT refresh_token
        FROM public.google_oauth_tokens
        WHERE user_id = #{userId}
          AND revoked_at IS NULL
        """)
    String findActiveRefreshTokenByUserId(@Param("userId") UUID userId);

    /**
     * Reads access token + expiration if you want to reuse it until it expires.
     * Returns null if not present or revoked.
     */
    @Select("""
        SELECT access_token
        FROM public.google_oauth_tokens
        WHERE user_id = #{userId}
          AND revoked_at IS NULL
        """)
    String findActiveAccessTokenByUserId(@Param("userId") UUID userId);

    @Select("""
        SELECT expires_at
        FROM public.google_oauth_tokens
        WHERE user_id = #{userId}
          AND revoked_at IS NULL
        """)
    OffsetDateTime findActiveAccessTokenExpiresAtByUserId(@Param("userId") UUID userId);

    /**
     * Save tokens after the OAuth callback OR after a refresh.
     * Uses UPSERT so it works for both first-time connect and later updates.
     */
    @Insert("""
    INSERT INTO public.google_oauth_tokens
        (user_id, refresh_token, access_token, expires_at, scope, revoked_at)
    VALUES
        (#{userId}, #{refreshToken}, #{accessToken}, #{expiresAt}, #{scope}, NULL)
    ON CONFLICT (user_id)
    DO UPDATE SET
        refresh_token = COALESCE(EXCLUDED.refresh_token, google_oauth_tokens.refresh_token),
        access_token  = EXCLUDED.access_token,
        expires_at    = EXCLUDED.expires_at,
        scope         = EXCLUDED.scope,
        revoked_at    = NULL,
        updated_at    = now()
    """)
    int upsertTokens(
            @Param("userId") UUID userId,
            @Param("refreshToken") String refreshToken,
            @Param("accessToken") String accessToken,
            @Param("expiresAt") OffsetDateTime expiresAt,
            @Param("scope") String scope
    );

    /**
     * If Google returns invalid_grant (revoked/expired refresh token), mark it revoked.
     */
    @Update("""
        UPDATE public.google_oauth_tokens
        SET revoked_at = now(),
            updated_at = now()
        WHERE user_id = #{userId}
          AND revoked_at IS NULL
        """)
    int revokeByUserId(@Param("userId") UUID userId);
}