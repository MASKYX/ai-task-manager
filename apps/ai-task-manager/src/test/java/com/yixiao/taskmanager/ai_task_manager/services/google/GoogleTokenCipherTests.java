package com.yixiao.taskmanager.ai_task_manager.services.google;

import org.junit.jupiter.api.Test;

import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class GoogleTokenCipherTests {
    private static GoogleTokenCipher cipher(byte fill) {
        byte[] key = new byte[32];
        java.util.Arrays.fill(key, fill);
        return new GoogleTokenCipher(Base64.getEncoder().encodeToString(key));
    }

    @Test
    void encryptsWithFreshNonceAndAuthenticatesCiphertext() {
        GoogleTokenCipher cipher = cipher((byte) 7);
        String first = cipher.encrypt("refresh-secret");
        String second = cipher.encrypt("refresh-secret");
        assertNotEquals(first, second);
        assertNotEquals("refresh-secret", first);
        assertEquals("refresh-secret", cipher.decrypt(first));
        assertThrows(IllegalStateException.class, () -> cipher((byte) 8).decrypt(first));
    }

    @Test
    void canReadLegacyPlaintextForMigration() {
        assertEquals("old-token", cipher((byte) 7).decrypt("old-token"));
        assertThrows(IllegalArgumentException.class, () -> new GoogleTokenCipher("not-a-key"));
    }
}
