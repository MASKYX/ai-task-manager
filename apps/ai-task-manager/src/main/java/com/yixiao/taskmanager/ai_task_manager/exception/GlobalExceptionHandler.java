package com.yixiao.taskmanager.ai_task_manager.exception;

import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(AgentException.class)
    public ResponseEntity<Map<String, String>> handleAgentException(AgentException ex) {
        return ResponseEntity.status(ex.getStatus()).body(Map.of(
                "error", ex.getMessage(), "layer", ex.getLayer(), "code", ex.getCode()));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, String>> handleInvalidRequest(HttpMessageNotReadableException ex) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                .body(Map.of("error", "The request has invalid fields or JSON.", "layer", "Spring Boot"));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, String>> handleAllExceptions(Exception ex) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Map.of("error", "An unexpected server error occurred.", "layer", "Spring Boot"));
    }
}
