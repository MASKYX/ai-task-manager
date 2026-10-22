import {
    addDaysToKey,
    dayKey,
    eventDurationDays,
    eventEndKey,
    eventStartKey,
    eventTitle,
    isValidDayKey,
    parseDayKey,
    todayKey,
} from "./calendar.ts";
import type { AiQuota, CalendarAction, CalendarEvent } from "./types.ts";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const DAY_SHORT_FORMAT = new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
});
const DAY_LONG_FORMAT = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
});
const DAY_NUMBER_FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
});

export function formatMonth(date: Date): string {
    return MONTH_FORMAT.format(date);
}

export function formatDateLong(date: Date): string {
    return DAY_LONG_FORMAT.format(date);
}

export function formatDayShort(date: Date): string {
    return DAY_SHORT_FORMAT.format(date);
}

export function formatDateShortKey(key: string): string {
    return isValidDayKey(key) ? DAY_NUMBER_FORMAT.format(parseDayKey(key)) : key;
}

export function formatTime(date: Date): string {
    return TIME_FORMAT.format(date);
}

export function formatDayHeading(key: string): string {
    const relative = key === todayKey()
        ? "Today"
        : key === addDaysToKey(todayKey(), 1)
            ? "Tomorrow"
            : key === addDaysToKey(todayKey(), -1)
                ? "Yesterday"
                : "";
    const date = isValidDayKey(key) ? formatDayShort(parseDayKey(key)) : key;
    return relative ? `${relative} · ${date}` : date;
}

export function formatDayTitle(key: string): string {
    return isValidDayKey(key) ? formatDateLong(parseDayKey(key)) : key;
}

export function formatCount(count: number, singular: string, plural = `${singular}s`): string {
    return `${count} ${count === 1 ? singular : plural}`;
}

export function formatAllDayRange(startKey: string, endExclusiveKey: string): string {
    if (!isValidDayKey(startKey)) return "All day";
    if (!isValidDayKey(endExclusiveKey)) return formatDateShortKey(startKey);

    const inclusiveEnd = addDaysToKey(endExclusiveKey, -1);
    if (inclusiveEnd <= startKey) return formatDateShortKey(startKey);
    return `${formatDateShortKey(startKey)} – ${formatDateShortKey(inclusiveEnd)}`;
}

export function formatEventTiming(event: CalendarEvent): string {
    if (event.allDay) {
        const duration = eventDurationDays(event);
        return duration > 1
            ? `All day · ${formatAllDayRange(eventStartKey(event), eventEndKey(event))}`
            : "All day";
    }

    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "Time unavailable";

    if (dayKey(start) === dayKey(end)) {
        return `${formatTime(start)} – ${formatTime(end)}`;
    }
    return `${formatDateShortKey(dayKey(start))} ${formatTime(start)} – ${formatDateShortKey(dayKey(end))} ${formatTime(end)}`;
}

export function formatEventWhen(event: CalendarEvent): string {
    const startKey = eventStartKey(event);
    const date = isValidDayKey(startKey) ? formatDateShortKey(startKey) : "";
    const timing = formatEventTiming(event);
    if (event.allDay) return timing;
    return date ? `${date} · ${timing}` : timing;
}

export function formatEventLabel(event: CalendarEvent): string {
    return `${eventTitle(event)}. ${formatEventWhen(event)}.`;
}

function actionTiming(action: CalendarAction): string {
    if (!action.startDateTime) return "";

    if (action.allDay) {
        const startKey = action.startDateTime.slice(0, 10);
        const endKey = action.endDateTime?.slice(0, 10) ?? addDaysToKey(startKey, 1);
        return `All day · ${formatAllDayRange(startKey, endKey)}`;
    }

    const start = new Date(action.startDateTime);
    const end = action.endDateTime ? new Date(action.endDateTime) : null;
    if (Number.isNaN(start.getTime())) return "";

    if (!end || Number.isNaN(end.getTime())) return formatTime(start);
    if (dayKey(start) === dayKey(end)) {
        return `${formatDateShortKey(dayKey(start))} · ${formatTime(start)} – ${formatTime(end)}`;
    }
    return `${formatDateShortKey(dayKey(start))} ${formatTime(start)} – ${formatDateShortKey(dayKey(end))} ${formatTime(end)}`;
}

export function formatAction(action: CalendarAction): string {
    const verb = action.type === "CREATE_EVENT"
        ? "Create"
        : action.type === "UPDATE_EVENT"
            ? "Update"
            : "Delete";
    const name = action.summary?.trim() || (action.eventId ? "event" : "a new event");
    const timing = action.type === "DELETE_EVENT" ? "" : actionTiming(action);
    return timing ? `${verb} “${name}” · ${timing}` : `${verb} “${name}”`;
}

export function formatQuota(quota: AiQuota): string {
    const remaining = Math.max(0, quota.remaining);
    return `${remaining} of ${quota.limit} requests left today`;
}

export function formatQuotaTooltip(quota: AiQuota | null): string {
    if (!quota) return "AI request limit information.";
    return `You can send up to ${quota.limit} AI requests per day. The limit resets daily.`;
}

export function formatTimeZone(): string {
    try {
        return Intl.DateTimeFormat().resolvedOptions().timeZone || "your local time zone";
    } catch {
        return "your local time zone";
    }
}
