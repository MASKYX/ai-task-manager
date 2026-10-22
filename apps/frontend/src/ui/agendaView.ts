import {
    eventAgendaDayKey,
    eventDurationDays,
    eventEndKey,
    eventIntersectsMonth,
    eventStartKey,
    sortEvents,
} from "../calendar.ts";
import {
    formatAllDayRange,
    formatCount,
    formatDayHeading,
    formatDayTitle,
    formatEventLabel,
    formatEventTiming,
    formatTime,
} from "../format.ts";
import { create } from "./dom.ts";
import { icon } from "./icons.ts";
import type { CalendarEvent } from "../types.ts";

type AgendaOptions = {
    viewDate: Date;
    events: CalendarEvent[];
    loading: boolean;
    error: string | null;
    onOpenEvent: (event: CalendarEvent) => void;
    onAdd: () => void;
    onRetry: () => void;
};

function eventButton(event: CalendarEvent, onOpen: (event: CalendarEvent) => void): HTMLLIElement {
    const item = create("li");
    const button = create("button", "agenda-event");
    button.type = "button";
    button.setAttribute("aria-label", `${formatEventLabel(event)} Edit event.`);

    const time = create("span", "agenda-event-time");
    if (event.allDay) {
        time.appendChild(create("span", "agenda-event-all-day", "All day"));
    } else {
        time.appendChild(create("span", "agenda-event-time-value", formatTime(new Date(event.startDateTime))));
        time.appendChild(create("span", "agenda-event-time-end", formatTime(new Date(event.endDateTime))));
    }

    const marker = create("span", `agenda-event-marker ${event.allDay ? "is-all-day" : ""}`);
    const body = create("span", "agenda-event-body");
    body.appendChild(create("span", "agenda-event-title", event.summary?.trim() || "Untitled event"));

    const metaParts: string[] = [];
    if (event.allDay && eventDurationDays(event) > 1) {
        metaParts.push(formatAllDayRange(eventStartKey(event), eventEndKey(event)));
    } else if (!event.allDay && eventStartKey(event) !== eventEndKey(event)) {
        metaParts.push(formatEventTiming(event));
    }
    if (event.description?.trim()) metaParts.push(event.description.trim());
    if (metaParts.length > 0) {
        body.appendChild(create("span", "agenda-event-meta", metaParts.join(" · ")));
    }

    button.append(time, marker, body);
    button.addEventListener("click", () => onOpen(event));
    item.appendChild(button);
    return item;
}

function renderEmpty(onAdd: () => void): HTMLElement {
    const empty = create("div", "empty-state");
    const emptyIcon = create("span", "empty-icon");
    emptyIcon.appendChild(icon("calendar", 24));
    const button = create("button", "btn btn-secondary btn-sm");
    button.type = "button";
    button.append(icon("plus", 16), document.createTextNode("Add an event"));
    button.addEventListener("click", onAdd);

    empty.append(
        emptyIcon,
        create("h3", "empty-title", "Nothing on the calendar"),
        create("p", "empty-copy", "When you add an event, it will show up here."),
        button,
    );
    return empty;
}

export function renderAgenda(container: HTMLElement, options: AgendaOptions): void {
    container.replaceChildren();

    if (options.loading) {
        container.setAttribute("aria-busy", "true");
        for (let index = 0; index < 4; index += 1) {
            const skeleton = create("div", "agenda-skeleton");
            skeleton.append(
                create("span", "skeleton agenda-skeleton-time"),
                create("span", "skeleton agenda-skeleton-line"),
            );
            container.appendChild(skeleton);
        }
        return;
    }
    container.removeAttribute("aria-busy");

    if (options.error) {
        const error = create("div", "empty-state empty-state--error");
        const errorIcon = create("span", "empty-icon");
        errorIcon.appendChild(icon("alert", 22));
        const retry = create("button", "btn btn-secondary btn-sm");
        retry.type = "button";
        retry.append(icon("refresh", 16), document.createTextNode("Try again"));
        retry.addEventListener("click", options.onRetry);
        error.append(
            errorIcon,
            create("h3", "empty-title", "The calendar did not load"),
            create("p", "empty-copy", options.error),
            retry,
        );
        container.appendChild(error);
        return;
    }

    const monthEvents = sortEvents(options.events.filter((event) => eventIntersectsMonth(event, options.viewDate)));
    if (monthEvents.length === 0) {
        container.appendChild(renderEmpty(options.onAdd));
        return;
    }

    const grouped = new Map<string, CalendarEvent[]>();
    for (const event of monthEvents) {
        const key = eventAgendaDayKey(event, options.viewDate);
        const dayEvents = grouped.get(key) ?? [];
        dayEvents.push(event);
        grouped.set(key, dayEvents);
    }

    for (const [key, dayEvents] of grouped) {
        const group = create("section", "agenda-group");
        group.setAttribute("aria-label", formatDayTitle(key));

        const heading = create("div", "agenda-group-head");
        const headingText = create("h3", "agenda-date", formatDayHeading(key));
        const count = create("span", "agenda-count", formatCount(dayEvents.length, "event"));
        heading.append(headingText, count);

        const list = create("ul", "agenda-list");
        for (const event of dayEvents) list.appendChild(eventButton(event, options.onOpenEvent));

        group.append(heading, list);
        container.appendChild(group);
    }
}
