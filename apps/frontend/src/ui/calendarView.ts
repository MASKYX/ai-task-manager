import {
    addDays,
    dayKey,
    eventDayKeys,
    groupEventsByDay,
    monthGrid,
    type DayCell,
} from "../calendar.ts";
import {
    formatCount,
    formatDateLong,
    formatEventLabel,
    formatTime,
} from "../format.ts";
import type { CalendarEvent } from "../types.ts";
import { create, queryAll } from "./dom.ts";
import { icon } from "./icons.ts";

type CalendarOptions = {
    viewDate: Date;
    events: CalendarEvent[];
    selectedDate: Date;
    loading: boolean;
    onSelectDay: (date: Date) => void;
    onOpenEvent: (event: CalendarEvent) => void;
    onMoveEvent: (event: CalendarEvent, date: Date) => void;
    onNavigateDay: (date: Date) => void;
};

const MOBILE_DOTS = 3;

function eventChip(event: CalendarEvent): HTMLButtonElement {
    const chip = create("button", `event-chip ${event.allDay ? "event-chip--all-day" : "event-chip--timed"}`);
    chip.type = "button";
    chip.draggable = true;
    chip.title = formatEventLabel(event);
    chip.setAttribute("aria-label", `${formatEventLabel(event)} Edit event.`);

    const title = create("span", "event-chip-title", event.summary?.trim() || "Untitled event");
    const time = create(
        "span",
        "event-chip-time",
        event.allDay ? "All day" : formatTime(new Date(event.startDateTime)),
    );
    chip.append(title, time);

    return chip;
}

function markSelectedDay(container: HTMLElement, key: string): void {
    for (const button of queryAll<HTMLButtonElement>("button.day-number", container)) {
        button.tabIndex = button.dataset.date === key ? 0 : -1;
    }
}

function buildCell(
    cell: DayCell,
    events: CalendarEvent[],
    selectedKey: string,
    focusKey: string,
    options: CalendarOptions,
    eventById: Map<string, CalendarEvent>,
    grid: HTMLElement,
): HTMLElement {
    const element = create("div", "calendar-cell");
    element.setAttribute("role", "gridcell");
    element.dataset.date = cell.key;
    if (!cell.inMonth) element.classList.add("is-outside");
    if (cell.isWeekend) element.classList.add("is-weekend");
    if (cell.isToday) element.classList.add("is-today");
    if (cell.key === selectedKey) element.classList.add("is-selected");
    if (events.length > 0) element.classList.add("has-events");
    element.setAttribute("aria-selected", String(cell.key === selectedKey));

    const dayButton = create("button", "day-number", String(cell.date.getDate()));
    dayButton.type = "button";
    dayButton.dataset.date = cell.key;
    dayButton.tabIndex = cell.key === focusKey ? 0 : -1;
    dayButton.setAttribute(
        "aria-label",
        `${formatDateLong(cell.date)}. ${formatCount(events.length, "event")}. View or add events.`,
    );
    if (cell.isToday) dayButton.setAttribute("aria-current", "date");
    dayButton.addEventListener("click", (event) => {
        event.stopPropagation();
        markSelectedDay(grid, cell.key);
        options.onSelectDay(cell.date);
    });
    element.appendChild(dayButton);

    if (events.length > 0) {
        const list = create("div", "cell-events");
        for (const event of events) {
            const chip = eventChip(event);
            chip.addEventListener("click", (clickEvent) => {
                clickEvent.stopPropagation();
                options.onOpenEvent(event);
            });
            chip.addEventListener("dragstart", (dragEvent) => {
                dragEvent.dataTransfer?.setData("text/plain", event.id);
                if (dragEvent.dataTransfer) dragEvent.dataTransfer.effectAllowed = "move";
                chip.classList.add("is-dragging");
            });
            chip.addEventListener("dragend", () => chip.classList.remove("is-dragging"));
            list.appendChild(chip);
        }
        element.appendChild(list);

        const dots = create("div", "cell-dots");
        dots.setAttribute("aria-hidden", "true");
        for (const event of events.slice(0, MOBILE_DOTS)) {
            const dot = create("span", `cell-dot ${event.allDay ? "cell-dot--all-day" : "cell-dot--timed"}`);
            dots.appendChild(dot);
        }
        if (events.length > MOBILE_DOTS) {
            dots.appendChild(create("span", "cell-dot-more", `+${events.length - MOBILE_DOTS}`));
        }
        element.appendChild(dots);
    }

    const addHint = create("span", "cell-add-hint");
    addHint.setAttribute("aria-hidden", "true");
    addHint.appendChild(icon("plus", 14));
    element.appendChild(addHint);

    element.addEventListener("click", (event) => {
        if ((event.target as Element).closest("button")) return;
        options.onSelectDay(cell.date);
    });

    element.addEventListener("dragover", (event) => {
        event.preventDefault();
        if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
        element.classList.add("is-drop-target");
    });
    element.addEventListener("dragleave", () => element.classList.remove("is-drop-target"));
    element.addEventListener("drop", (event) => {
        event.preventDefault();
        element.classList.remove("is-drop-target");
        const id = event.dataTransfer?.getData("text/plain");
        const dropped = id ? eventById.get(id) : undefined;
        if (!dropped) return;
        if (eventDayKeys(dropped).includes(cell.key)) return;
        options.onMoveEvent(dropped, cell.date);
    });

    return element;
}

function focusKeyFor(cells: DayCell[], selectedDate: Date): string {
    const selectedKey = dayKey(selectedDate);
    if (cells.some((cell) => cell.key === selectedKey)) return selectedKey;
    const today = cells.find((cell) => cell.isToday);
    if (today) return today.key;
    return (cells.find((cell) => cell.inMonth) ?? cells[0]).key;
}

export function renderCalendar(container: HTMLElement, options: CalendarOptions): void {
    container.replaceChildren();

    if (options.loading) {
        container.setAttribute("aria-busy", "true");
        for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
            const row = create("div", "calendar-week");
            row.setAttribute("role", "row");
            for (let index = 0; index < 7; index += 1) {
                const skeleton = create("div", "calendar-cell calendar-cell--skeleton");
                skeleton.setAttribute("role", "gridcell");
                skeleton.appendChild(create("span", "skeleton skeleton-line"));
                row.appendChild(skeleton);
            }
            container.appendChild(row);
        }
        return;
    }

    container.removeAttribute("aria-busy");
    const cells = monthGrid(options.viewDate);
    const selectedKey = dayKey(options.selectedDate);
    const focusKey = focusKeyFor(cells, options.selectedDate);
    const grouped = groupEventsByDay(options.events);
    const eventById = new Map(options.events.map((event) => [event.id, event]));

    for (let rowIndex = 0; rowIndex < 6; rowIndex += 1) {
        const row = create("div", "calendar-week");
        row.setAttribute("role", "row");

        for (const cell of cells.slice(rowIndex * 7, rowIndex * 7 + 7)) {
            row.appendChild(
                buildCell(cell, grouped.get(cell.key) ?? [], selectedKey, focusKey, options, eventById, container),
            );
        }
        container.appendChild(row);
    }

    container.onkeydown = (event) => {
        const target = event.target as HTMLElement;
        const dayButton = target.closest<HTMLButtonElement>("button.day-number");
        if (!dayButton) return;

        const deltas: Record<string, number> = {
            ArrowLeft: -1,
            ArrowRight: 1,
            ArrowUp: -7,
            ArrowDown: 7,
        };
        const delta = deltas[event.key];
        if (delta === undefined) return;

        const currentKey = dayButton.dataset.date;
        if (!currentKey) return;

        event.preventDefault();
        const targetDate = addDays(new Date(`${currentKey}T12:00:00`), delta);
        const targetKey = dayKey(targetDate);
        const targetButton = container.querySelector<HTMLButtonElement>(
            `button.day-number[data-date="${targetKey}"]`,
        );

        if (targetButton) {
            markSelectedDay(container, targetKey);
            targetButton.focus();
        } else {
            options.onNavigateDay(targetDate);
        }
    };
}

export function renderSelectedDay(
    container: HTMLElement,
    date: Date,
    events: CalendarEvent[],
    loading: boolean,
    onOpenEvent: (event: CalendarEvent) => void,
): void {
    container.replaceChildren();

    const head = create("div", "selected-day-head");
    const copy = create("div");
    copy.append(
        create("p", "eyebrow", "Selected day"),
        create("h3", "selected-day-title", formatDateLong(date)),
    );
    head.append(copy);
    container.appendChild(head);

    if (loading) {
        const skeleton = create("div", "selected-day-list");
        for (let index = 0; index < 2; index += 1) {
            const row = create("div", "selected-day-skeleton");
            row.append(create("span", "skeleton skeleton-dot"), create("span", "skeleton skeleton-line"));
            skeleton.appendChild(row);
        }
        container.appendChild(skeleton);
        return;
    }

    if (events.length === 0) {
        const empty = create("div", "empty-state empty-state--compact");
        const emptyIcon = create("span", "empty-icon");
        emptyIcon.appendChild(icon("calendar", 20));
        empty.append(
            emptyIcon,
            create("p", "empty-title", "Nothing planned"),
            create("p", "empty-copy", "Enjoy the space, or add something new."),
        );
        container.appendChild(empty);
        return;
    }

    const list = create("div", "selected-day-list");
    for (const event of events) {
        const button = create("button", "day-event");
        button.type = "button";
        button.setAttribute("aria-label", `${formatEventLabel(event)} Edit event.`);

        const marker = create("span", `day-event-marker ${event.allDay ? "is-all-day" : ""}`);
        const body = create("span", "day-event-body");
        body.append(
            create("span", "day-event-time", event.allDay ? "All day" : formatTime(new Date(event.startDateTime))),
            create("span", "day-event-title", event.summary?.trim() || "Untitled event"),
        );
        button.append(marker, body);
        button.addEventListener("click", () => onOpenEvent(event));
        list.appendChild(button);
    }
    container.appendChild(list);
}
