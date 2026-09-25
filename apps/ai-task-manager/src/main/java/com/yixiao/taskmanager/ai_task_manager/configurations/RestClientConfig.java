package com.yixiao.taskmanager.ai_task_manager.configurations;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.client.RestClient;

import java.time.Clock;
import java.time.ZoneId;

@Configuration
public class RestClientConfig {

    @Bean
    public RestClient.Builder restClientBuilder() {
        return RestClient.builder();
    }

    @Bean
    public Clock applicationClock(@Value("${agent.time-zone:Europe/Madrid}") String timeZone) {
        return Clock.system(ZoneId.of(timeZone));
    }
}
