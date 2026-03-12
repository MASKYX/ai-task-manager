package com.yixiao.taskmanager.ai_task_manager.controllers;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.services.google.GoogleTokenService;
import com.yixiao.taskmanager.ai_task_manager.services.google.GoogleCalendarService;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    @Autowired
    private GoogleTokenService googleTokenService;

    @Autowired
    private GoogleCalendarService googleCalendarService;

    @GetMapping("/events/upcoming")
    public List<CalendarEventDto> getUpcomingEvents(Authentication authentication,
                                                    HttpServletRequest request,
                                                    HttpServletResponse response) {

        String accessToken = googleTokenService.getAccessToken(authentication);
        return googleCalendarService.getUpcomingEvents(accessToken);
    }

    @GetMapping("/events")
    public List<CalendarEventDto> getEventsInDateRange(Authentication authentication,
                                                       HttpServletRequest request,
                                                       HttpServletResponse response,
                                                       @RequestParam String timeMin,
                                                       @RequestParam String timeMax) {

        String accessToken = googleTokenService.getAccessToken(authentication);
        return googleCalendarService.getEventsInDateRange(accessToken, timeMin, timeMax);
    }

    @PostMapping("/events")
    public CalendarEventDto createEvent(Authentication authentication,
                                        HttpServletRequest request,
                                        HttpServletResponse response,
                                        @RequestBody CalendarEventDto calendarEventDto) {

        String accessToken = googleTokenService.getAccessToken(authentication);
        return googleCalendarService.createEvent(accessToken, calendarEventDto);
    }

    @PutMapping("/events/{eventId}")
    public CalendarEventDto updateEvent(Authentication authentication,
                                        HttpServletRequest request,
                                        HttpServletResponse response,
                                        @PathVariable String eventId,
                                        @RequestBody CalendarEventDto calendarEventDto) {

        String accessToken = googleTokenService.getAccessToken(authentication);
        return googleCalendarService.updateEvent(accessToken, eventId, calendarEventDto);
    }

    @DeleteMapping("/events/{eventId}")
    public void deleteEvent(Authentication authentication,
                            HttpServletRequest request,
                            HttpServletResponse response,
                            @PathVariable String eventId) {

        String accessToken = googleTokenService.getAccessToken(authentication);
        googleCalendarService.deleteEvent(accessToken, eventId);
    }
}