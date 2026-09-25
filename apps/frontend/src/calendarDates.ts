export type CalendarEvent = {
    id?: string;
    summary?: string;
    description?: string;
    startDateTime: string;
    endDateTime: string;
    allDay: boolean;
};

export function localDateKey(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function eventDayKey(event: CalendarEvent): string {
    return event.allDay ? event.startDateTime.slice(0, 10) : localDateKey(new Date(event.startDateTime));
}

function addDateDays(value: string, days: number): string {
    const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}

export function moveEvent(event: CalendarEvent, target: Date): CalendarEvent {
    const destination = localDateKey(target);
    if (event.allDay) {
        const start = event.startDateTime.slice(0, 10);
        const end = event.endDateTime.slice(0, 10);
        const durationDays = Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000);
        return { ...event, startDateTime: destination, endDateTime: addDateDays(destination, durationDays) };
    }
    const oldStart = new Date(event.startDateTime);
    const oldEnd = new Date(event.endDateTime);
    const dayDifference = Math.round((Date.parse(`${destination}T00:00:00Z`) - Date.parse(`${localDateKey(oldStart)}T00:00:00Z`)) / 86400000);
    const newStart = new Date(oldStart);
    const newEnd = new Date(oldEnd);
    newStart.setDate(newStart.getDate() + dayDifference);
    newEnd.setDate(newEnd.getDate() + dayDifference);
    return { ...event, startDateTime: newStart.toISOString(), endDateTime: newEnd.toISOString() };
}

export function eventInputDate(value: string, allDay: boolean): string {
    return allDay ? value.slice(0, 10) : localDateKey(new Date(value));
}

export function eventInputTime(value: string, allDay: boolean): string {
    return allDay ? '00:00' : new Date(value).toTimeString().slice(0, 5);
}

export function formEventDates(startDate: string, startTime: string, endDate: string, endTime: string, allDay: boolean) {
    if (allDay) return { startDateTime: startDate, endDateTime: addDateDays(endDate, 1) };
    return {
        startDateTime: new Date(`${startDate}T${startTime}`).toISOString(),
        endDateTime: new Date(`${endDate}T${endTime}`).toISOString()
    };
}
