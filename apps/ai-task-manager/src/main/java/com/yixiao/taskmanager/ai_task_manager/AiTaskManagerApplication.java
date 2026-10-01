package com.yixiao.taskmanager.ai_task_manager;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AiTaskManagerApplication {

	public static void main(String[] args) {
		SpringApplication.run(AiTaskManagerApplication.class, args);
	}

}
