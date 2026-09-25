package com.yixiao.taskmanager.ai_task_manager.services.google;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

@Service
public class GoogleTokenCipher {
    private static final String PREFIX = "enc:v1:";
    private static final int IV_BYTES = 12;
    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public GoogleTokenCipher(@Value("${GOOGLE_TOKEN_ENCRYPTION_KEY}") String encodedKey) {
        byte[] bytes = Base64.getDecoder().decode(encodedKey);
        if (bytes.length != 32) {
            throw new IllegalArgumentException("GOOGLE_TOKEN_ENCRYPTION_KEY must contain 32 base64-encoded bytes");
        }
        this.key = new SecretKeySpec(bytes, "AES");
    }

    public boolean isEncrypted(String value) {
        return value == null || value.startsWith(PREFIX);
    }

    public String encrypt(String value) {
        if (value == null) return null;
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
            byte[] encrypted = cipher.doFinal(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            byte[] output = new byte[iv.length + encrypted.length];
            System.arraycopy(iv, 0, output, 0, iv.length);
            System.arraycopy(encrypted, 0, output, iv.length, encrypted.length);
            return PREFIX + Base64.getEncoder().encodeToString(output);
        } catch (GeneralSecurityException ex) {
            throw new IllegalStateException("Could not encrypt Google token");
        }
    }

    public String decrypt(String value) {
        if (value == null || !value.startsWith(PREFIX)) return value;
        try {
            byte[] input = Base64.getDecoder().decode(value.substring(PREFIX.length()));
            if (input.length <= IV_BYTES + 16) throw new IllegalArgumentException("Invalid ciphertext");
            byte[] iv = java.util.Arrays.copyOfRange(input, 0, IV_BYTES);
            byte[] encrypted = java.util.Arrays.copyOfRange(input, IV_BYTES, input.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, iv));
            return new String(cipher.doFinal(encrypted), java.nio.charset.StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException ex) {
            throw new IllegalStateException("Stored Google token cannot be decrypted");
        }
    }
}
