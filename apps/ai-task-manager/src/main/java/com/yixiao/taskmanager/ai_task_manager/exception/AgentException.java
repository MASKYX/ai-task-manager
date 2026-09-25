package com.yixiao.taskmanager.ai_task_manager.exception;

import org.springframework.http.HttpStatus;

public class AgentException extends RuntimeException {
    private final HttpStatus status;
    private final String layer;
    private final String code;

    public AgentException(HttpStatus status, String layer, String message) {
        this(status, layer, "AGENT_ERROR", message);
    }

    public AgentException(HttpStatus status, String layer, String code, String message) {
        super(message);
        this.status = status;
        this.layer = layer;
        this.code = code;
    }

    public HttpStatus getStatus() { return status; }
    public String getLayer() { return layer; }
    public String getCode() { return code; }
}
