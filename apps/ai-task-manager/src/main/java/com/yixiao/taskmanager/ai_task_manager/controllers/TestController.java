package com.yixiao.taskmanager.ai_task_manager.controllers;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/test")
@CrossOrigin(origins = "*")
public class TestController {

    @GetMapping("/public")
    public String publicTest(){
        return "Public Test OK!";
    }

    @GetMapping("/private")
    public String privateTest(){
        return "Private Test OK!";
    }

}
