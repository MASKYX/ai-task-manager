import type { CalendarEvent, EventInput } from "./types.ts";

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
export const MONTH_GRID_ROWS = 6;

export type DayCell = {
    date: Date;
    key: string;
    inMonth: boolean;
    isToday: boolean;
    isWeekend: boolean;
};

export type EventFormValues = {
    summary: string;
    description: string;
    allDay: boolean;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
};

export class EventValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "EventValidationError";
    }
}

export function atNoon(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
}

export function atMidnight(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function dayKey(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function todayKey(): string {
    return dayKey(new Date());
}

export function isValidDayKey(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day, 12);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseDayKey(value: string): Date {
    if (!isValidDayKey(value)) return new Date(Number.NaN);
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day, 12);
}

export function addDays(date: Date, days: number): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days, 12, 0, 0, 0);
}

export function addDaysToKey(value: string, days: number): string {
    return dayKey(addDays(parseDayKey(value), days));
}

export function addMonths(date: Date, months: number): Date {
    return new Date(date.getFullYear(), date.getMonth() + months, 1, 12, 0, 0, 0);
}

export function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1, 12, 0, 0, 0);
}

export function getMonday(date: Date): Date {
    const day = date.getDay();
    const offset = day === 0 ? -6 : 1 - day;
    return addDays(date, offset);
}

export function monthGrid(viewDate: Date): DayCell[] {
    const month = viewDate.getMonth();
    const today = todayKey();
    const start = getMonday(startOfMonth(viewDate));
    const cells: DayCell[] = [];

    for (let index = 0; index < MONTH_GRID_ROWS * 7; index += 1) {
        const date = addDays(start, index);
        const day = date.getDay();
        cells.push({
            date,
            key: dayKey(date),
            inMonth: date.getMonth() === month,
            isToday: dayKey(date) === today,
            isWeekend: day === 0 || day === 6,
        });
    }

    return cells;
}

export function monthRange(viewDate: Date): { start: Date; end: Date } {
    const start = atMidnight(getMonday(startOfMonth(viewDate)));
    const end = atMidnight(addDays(start, MONTH_GRID_ROWS * 7));
    return { start, end };
}

export function isInMonth(date: Date, viewDate: Date): boolean {
    return date.getFullYear() === viewDate.getFullYear() && date.getMonth() === viewDate.getMonth();
}

export function eventStart(event: CalendarEvent): Date {
    return event.allDay
        ? parseDayKey(event.startDateTime.slice(0, 10))
        : new Date(event.startDateTime);
}

export function eventEnd(event: CalendarEvent): Date {
    return event.allDay
        ? parseDayKey(event.endDateTime.slice(0, 10))
        : new Date(event.endDateTime);
}

export function eventStartKey(event: CalendarEvent): string {
    return event.allDay ? event.startDateTime.slice(0, 10) : dayKey(new Date(event.startDateTime));
}

export function eventEndKey(event: CalendarEvent): string {
    return event.allDay ? event.endDateTime.slice(0, 10) : dayKey(new Date(event.endDateTime));
}

export function eventTitle(event: CalendarEvent): string {
    return event.summary?.trim() || "Untitled event";
}

export function daysBetweenKeys(start: string, end: string): number {
    if (!isValidDayKey(start) || !isValidDayKey(end)) return 0;
    const [startYear, startMonth, startDay] = start.split("-").map(Number);
    const [endYear, endMonth, endDay] = end.split("-").map(Number);
    const startTime = Date.UTC(startYear, startMonth - 1, startDay);
    const endTime = Date.UTC(endYear, endMonth - 1, endDay);
    return Math.round((endTime - startTime) / 86_400_000);
}

export function eventDayKeys(event: CalendarEvent): string[] {
    const startKey = eventStartKey(event);
    if (!isValidDayKey(startKey)) return [];
    if (!event.allDay) return [startKey];

    const endKey = eventEndKey(event);
    if (!isValidDayKey(endKey) || daysBetweenKeys(startKey, endKey) <= 0) return [startKey];

    const keys: string[] = [];
    let cursor = startKey;
    for (let index = 0; index < 366 && cursor < endKey; index += 1) {
        keys.push(cursor);
        cursor = addDaysToKey(cursor, 1);
    }
    return keys;
}

export function eventIntersectsMonth(event: CalendarEvent, viewDate: Date): boolean {
    const start = eventStart(event);
    const end = eventEnd(event);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return false;

    const monthStart = atMidnight(startOfMonth(viewDate));
    const nextMonth = atMidnight(addMonths(viewDate, 1));
    // All-day end dates are exclusive and refer to midnight, not local noon.
    const rangeStart = event.allDay ? atMidnight(start) : start;
    const rangeEnd = event.allDay ? atMidnight(end) : end;
    return rangeStart < nextMonth && rangeEnd > monthStart;
}

export function eventAgendaDayKey(event: CalendarEvent, viewDate: Date): string {
    const startKey = eventStartKey(event);
    const monthStartKey = dayKey(startOfMonth(viewDate));
    return startKey < monthStartKey ? monthStartKey : startKey;
}

export function compareEvents(first: CalendarEvent, second: CalendarEvent): number {
    const firstKey = eventStartKey(first);
    const secondKey = eventStartKey(second);
    if (firstKey !== secondKey) return firstKey.localeCompare(secondKey);
    if (first.allDay !== second.allDay) return first.allDay ? -1 : 1;

    const startDifference = eventStart(first).getTime() - eventStart(second).getTime();
    if (startDifference !== 0) return startDifference;
    return eventTitle(first).localeCompare(eventTitle(second));
}

export function sortEvents(events: CalendarEvent[]): CalendarEvent[] {
    return [...events].sort(compareEvents);
}

export function groupEventsByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of events) {
        for (const key of eventDayKeys(event)) {
            const dayEvents = grouped.get(key) ?? [];
            dayEvents.push(event);
            grouped.set(key, dayEvents);
        }
    }
    for (const dayEvents of grouped.values()) dayEvents.sort(compareEvents);
    return grouped;
}

export function eventDurationDays(event: CalendarEvent): number {
    if (!event.allDay) return 0;
    return Math.max(1, daysBetweenKeys(eventStartKey(event), eventEndKey(event)));
}

export function moveEvent(event: CalendarEvent, targetDate: Date): EventInput {
    const summary = event.summary?.trim() ?? "";
    const description = event.description ?? "";
    const targetKey = dayKey(targetDate);

    if (event.allDay) {
        const duration = eventDurationDays(event);
        return {
            summary,
            description,
            startDateTime: targetKey,
            endDateTime: addDaysToKey(targetKey, duration),
            allDay: true,
        };
    }

    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        throw new EventValidationError("This event has an invalid date.");
    }

    const offset = daysBetweenKeys(dayKey(start), targetKey);
    const movedStart = new Date(
        start.getFullYear(),
        start.getMonth(),
        start.getDate() + offset,
        start.getHours(),
        start.getMinutes(),
        start.getSeconds(),
    );
    const movedEnd = new Date(
        end.getFullYear(),
        end.getMonth(),
        end.getDate() + offset,
        end.getHours(),
        end.getMinutes(),
        end.getSeconds(),
    );

    return {
        summary,
        description,
        startDateTime: movedStart.toISOString(),
        endDateTime: movedEnd.toISOString(),
        allDay: false,
    };
}

export function toDateInput(value: string, allDay: boolean): string {
    if (allDay) return value.slice(0, 10);
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "" : dayKey(date);
}

export function toTimeInput(value: string, allDay: boolean): string {
    if (allDay) return "00:00";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export function toInclusiveEndDate(value: string, allDay: boolean): string {
    if (!allDay) return toDateInput(value, false);
    const endKey = value.slice(0, 10);
    if (!isValidDayKey(endKey)) return "";
    return addDaysToKey(endKey, -1);
}

export function formFromEvent(event: CalendarEvent): EventFormValues {
    const startDate = toDateInput(event.startDateTime, event.allDay) || todayKey();
    const endDate = toInclusiveEndDate(event.endDateTime, event.allDay) || startDate;

    return {
        summary: event.summary ?? "",
        description: event.description ?? "",
        allDay: event.allDay,
        startDate,
        startTime: event.allDay ? "00:00" : toTimeInput(event.startDateTime, false) || "09:00",
        endDate,
        endTime: event.allDay ? "00:00" : toTimeInput(event.endDateTime, false) || "10:00",
    };
}

export function defaultForm(date: Date): EventFormValues {
    const startDate = dayKey(date);
    let startHour = 9;

    const now = new Date();
    if (startDate === todayKey() && now.getHours() >= 9) {
        startHour = Math.min(now.getHours() + 1, 22);
    }
    const endHour = Math.min(startHour + 1, 23);

    return {
        summary: "",
        description: "",
        allDay: false,
        startDate,
        startTime: `${String(startHour).padStart(2, "0")}:00`,
        endDate: startDate,
        endTime: `${String(endHour).padStart(2, "0")}:00`,
    };
}

function isValidTime(value: string): boolean {
    if (!/^\d{2}:\d{2}$/.test(value)) return false;
    const [hours, minutes] = value.split(":").map(Number);
    return hours >= 0 && hours < 24 && minutes >= 0 && minutes < 60;
}

export function validateEventForm(form: EventFormValues): string | null {
    if (!form.summary.trim()) return "Enter a title for the event.";
    if (form.summary.trim().length > 255) return "Keep the title under 255 characters.";
    if (form.description.length > 10_000) return "Keep the description under 10,000 characters.";
    if (!isValidDayKey(form.startDate)) return "Choose a valid start date.";
    if (!isValidDayKey(form.endDate)) return "Choose a valid end date.";

    if (form.allDay) {
        if (form.endDate < form.startDate) return "The end date must be on or after the start date.";
        return null;
    }

    if (!isValidTime(form.startTime)) return "Choose a valid start time.";
    if (!isValidTime(form.endTime)) return "Choose a valid end time.";

    const start = new Date(`${form.startDate}T${form.startTime}:00`);
    const end = new Date(`${form.endDate}T${form.endTime}:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return "Choose a valid start and end date.";
    }
    if (end.getTime() <= start.getTime()) return "The end must be after the start.";

    return null;
}

export function buildEventInput(form: EventFormValues): EventInput {
    const error = validateEventForm(form);
    if (error) throw new EventValidationError(error);

    const summary = form.summary.trim();
    const description = form.description.trim();

    if (form.allDay) {
        return {
            summary,
            description,
            startDateTime: form.startDate,
            endDateTime: addDaysToKey(form.endDate, 1),
            allDay: true,
        };
    }

    const start = new Date(`${form.startDate}T${form.startTime}:00`);
    const end = new Date(`${form.endDate}T${form.endTime}:00`);

    return {
        summary,
        description,
        startDateTime: start.toISOString(),
        endDateTime: end.toISOString(),
        allDay: false,
    };
}
