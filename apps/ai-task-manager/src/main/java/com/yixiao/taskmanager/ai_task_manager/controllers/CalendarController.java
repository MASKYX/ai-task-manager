package com.yixiao.taskmanager.ai_task_manager.controllers;

import com.yixiao.taskmanager.ai_task_manager.dto.CalendarEventDto;
import com.yixiao.taskmanager.ai_task_manager.entities.CalendarProviderType;
import com.yixiao.taskmanager.ai_task_manager.services.calendar.CalendarService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@Slf4j
@RestController
@RequestMapping("/api/calendar")
public class CalendarController {

    private final CalendarService calendarService;

    public CalendarController(CalendarService calendarService) {
        this.calendarService = calendarService;
    }

    @GetMapping("/events/upcoming")
    public ResponseEntity<List<CalendarEventDto>> getUpcomingEvents(Authentication authentication) {
        return ResponseEntity.ok(calendarService.getUpcomingEvents(authentication));
    }

    @GetMapping("/events")
    public ResponseEntity<List<CalendarEventDto>> getEventsInDateRange(
            Authentication authentication,
            @RequestParam String timeMin,
            @RequestParam String timeMax
    ) {
        return ResponseEntity.ok(
                calendarService.getEventsInDateRange(authentication, timeMin, timeMax)
        );
    }

    @PostMapping("/events")
    public ResponseEntity<CalendarEventDto> createEvent(
            Authentication authentication,
            @RequestBody CalendarEventDto calendarEventDto
    ) {
        return ResponseEntity.ok(calendarService.createEvent(authentication, calendarEventDto));
    }

    @PutMapping("/events/{eventId}")
    public ResponseEntity<CalendarEventDto> updateEvent(
            Authentication authentication,
            @PathVariable String eventId,
            @RequestBody CalendarEventDto calendarEventDto
    ) {
        return ResponseEntity.ok(
                calendarService.updateEvent(authentication, eventId, calendarEventDto)
        );
    }

    @DeleteMapping("/events/{eventId}")
    public ResponseEntity<Void> deleteEvent(
            Authentication authentication,
            @PathVariable String eventId
    ) {
        calendarService.deleteEvent(authentication, eventId);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/provider")
    public ResponseEntity<CalendarProviderType> getProvider(Authentication authentication) {
        return ResponseEntity.ok(calendarService.getProviderType(authentication));
    }

    @PutMapping("/provider")
    public ResponseEntity<CalendarProviderType> updateProvider(
            Authentication authentication,
            @RequestParam CalendarProviderType provider
    ) {
        return ResponseEntity.ok(calendarService.updateProvider(authentication, provider));
    }
}