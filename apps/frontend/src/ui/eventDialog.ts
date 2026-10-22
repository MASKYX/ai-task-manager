import {
    buildEventInput,
    defaultForm,
    formFromEvent,
    validateEventForm,
    type EventFormValues,
} from "../calendar.ts";
import { errorMessage } from "../api.ts";
import { formatTimeZone } from "../format.ts";
import type { CalendarEvent, EventInput } from "../types.ts";
import { query } from "./dom.ts";
import { confirmAction } from "./dialog.ts";

type EventDialogHandlers = {
    onSave: (id: string | null, input: EventInput) => Promise<void>;
    onDelete: (event: CalendarEvent) => Promise<void>;
};

export class EventDialog {
    private readonly dialog: HTMLDialogElement;
    private readonly form: HTMLFormElement;
    private readonly heading: HTMLElement;
    private readonly titleInput: HTMLInputElement;
    private readonly descriptionInput: HTMLTextAreaElement;
    private readonly allDayInput: HTMLInputElement;
    private readonly startDateInput: HTMLInputElement;
    private readonly startTimeInput: HTMLInputElement;
    private readonly endDateInput: HTMLInputElement;
    private readonly endTimeInput: HTMLInputElement;
    private readonly startTimeWrap: HTMLElement;
    private readonly endTimeWrap: HTMLElement;
    private readonly errorBox: HTMLElement;
    private readonly errorText: HTMLElement;
    private readonly saveButton: HTMLButtonElement;
    private readonly cancelButton: HTMLButtonElement;
    private readonly deleteButton: HTMLButtonElement;
    private readonly closeButton: HTMLButtonElement;
    private readonly handlers: EventDialogHandlers;

    private editingEvent: CalendarEvent | null = null;
    private busy = false;

    constructor(handlers: EventDialogHandlers) {
        this.handlers = handlers;
        this.dialog = query("#event-dialog");
        this.form = query("#event-form");
        this.heading = query("#event-dialog-title");
        this.titleInput = query("#event-title");
        this.descriptionInput = query("#event-description");
        this.allDayInput = query("#event-all-day");
        this.startDateInput = query("#event-start-date");
        this.startTimeInput = query("#event-start-time");
        this.endDateInput = query("#event-end-date");
        this.endTimeInput = query("#event-end-time");
        this.startTimeWrap = query("#event-start-time-wrap");
        this.endTimeWrap = query("#event-end-time-wrap");
        this.errorBox = query("#event-error");
        this.errorText = query("#event-error-text");
        this.saveButton = query("#event-save");
        this.cancelButton = query("#event-cancel");
        this.deleteButton = query("#event-delete");
        this.closeButton = query("#event-close");

        query("#event-timezone").textContent = formatTimeZone();
        this.bindEvents();
    }

    openCreate(date: Date): void {
        this.open(null, defaultForm(date));
    }

    openEdit(event: CalendarEvent): void {
        this.open(event, formFromEvent(event));
    }

    private open(event: CalendarEvent | null, values: EventFormValues): void {
        if (this.dialog.open) this.dialog.close();
        this.editingEvent = event;
        this.heading.textContent = event ? "Edit event" : "New event";
        this.saveButton.textContent = event ? "Save changes" : "Add event";
        this.deleteButton.hidden = !event;

        this.titleInput.value = values.summary;
        this.descriptionInput.value = values.description;
        this.allDayInput.checked = values.allDay;
        this.startDateInput.value = values.startDate;
        this.startTimeInput.value = values.startTime;
        this.endDateInput.value = values.endDate;
        this.endTimeInput.value = values.endTime;

        this.syncAllDayFields();
        this.endDateInput.min = this.startDateInput.value;
        this.setError(null);
        this.setBusy(false);

        this.dialog.showModal();
        window.setTimeout(() => this.titleInput.focus(), 0);
    }

    private bindEvents(): void {
        this.form.addEventListener("submit", (event) => {
            event.preventDefault();
            void this.submit();
        });

        this.closeButton.addEventListener("click", () => this.close());
        this.cancelButton.addEventListener("click", () => this.close());
        this.allDayInput.addEventListener("change", () => {
            if (!this.allDayInput.checked && this.startTimeInput.value === "00:00"
                && this.endTimeInput.value === "00:00") {
                this.startTimeInput.value = "09:00";
                this.endTimeInput.value = "10:00";
            }
            this.syncAllDayFields();
            this.endDateInput.min = this.startDateInput.value;
            this.clearError();
        });

        this.startDateInput.addEventListener("change", () => {
            if (this.endDateInput.value < this.startDateInput.value) {
                this.endDateInput.value = this.startDateInput.value;
            }
            this.endDateInput.min = this.startDateInput.value;
            this.clearError();
        });

        this.startTimeInput.addEventListener("change", () => {
            if (this.allDayInput.checked) return;
            const start = this.readStart();
            const end = this.readEnd();
            if (!start || !end || end.getTime() > start.getTime()) return;

            const adjusted = new Date(start.getTime() + 60 * 60 * 1000);
            this.endDateInput.value = this.dateValue(adjusted);
            this.endTimeInput.value = this.timeValue(adjusted);
        });

        this.deleteButton.addEventListener("click", () => {
            void this.deleteEvent();
        });

        this.dialog.addEventListener("click", (event) => {
            if (event.target === this.dialog && !this.busy) this.close();
        });
        this.dialog.addEventListener("cancel", (event) => {
            if (this.busy) event.preventDefault();
        });
        this.dialog.addEventListener("close", () => {
            this.setError(null);
            window.setTimeout(() => {
                if (document.activeElement === document.body) {
                    document.getElementById("calendar-panel")?.focus();
                }
            }, 0);
        });

        for (const input of [
            this.titleInput,
            this.descriptionInput,
            this.startDateInput,
            this.endDateInput,
            this.startTimeInput,
            this.endTimeInput,
        ]) {
            input.addEventListener("input", () => this.clearError());
        }
    }

    private async submit(): Promise<void> {
        if (this.busy) return;

        const values: EventFormValues = {
            summary: this.titleInput.value,
            description: this.descriptionInput.value,
            allDay: this.allDayInput.checked,
            startDate: this.startDateInput.value,
            startTime: this.startTimeInput.value,
            endDate: this.endDateInput.value,
            endTime: this.endTimeInput.value,
        };

        const validationError = validateEventForm(values);
        if (validationError) {
            this.setError(validationError);
            return;
        }

        let input: EventInput;
        try {
            input = buildEventInput(values);
        } catch (error) {
            this.setError(errorMessage(error));
            return;
        }

        this.setBusy(true);
        try {
            await this.handlers.onSave(this.editingEvent?.id ?? null, input);
            this.dialog.close();
        } catch (error) {
            this.setError(errorMessage(error));
        } finally {
            this.setBusy(false);
        }
    }

    private async deleteEvent(): Promise<void> {
        if (!this.editingEvent || this.busy) return;

        const event = this.editingEvent;
        const confirmed = await confirmAction({
            title: "Delete this event?",
            message: `“${event.summary?.trim() || "Untitled event"}” will be removed from your calendar.`,
            confirmLabel: "Delete event",
            danger: true,
        });
        if (!confirmed) return;

        this.setBusy(true);
        try {
            await this.handlers.onDelete(event);
            this.dialog.close();
        } catch (error) {
            this.setError(errorMessage(error));
        } finally {
            this.setBusy(false);
        }
    }

    private syncAllDayFields(): void {
        const allDay = this.allDayInput.checked;
        this.startTimeInput.disabled = allDay;
        this.endTimeInput.disabled = allDay;
        this.startTimeWrap.classList.toggle("is-disabled", allDay);
        this.endTimeWrap.classList.toggle("is-disabled", allDay);

        if (allDay) {
            if (this.endDateInput.value < this.startDateInput.value) {
                this.endDateInput.value = this.startDateInput.value;
            }
            return;
        }
    }

    private readStart(): Date | null {
        return this.readDateTime(this.startDateInput.value, this.startTimeInput.value);
    }

    private readEnd(): Date | null {
        return this.readDateTime(this.endDateInput.value, this.endTimeInput.value);
    }

    private readDateTime(date: string, time: string): Date | null {
        if (!date || !time) return null;
        const value = new Date(`${date}T${time}:00`);
        return Number.isNaN(value.getTime()) ? null : value;
    }

    private dateValue(date: Date): string {
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    }

    private timeValue(date: Date): string {
        return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
    }

    private close(): void {
        if (this.busy) return;
        if (this.dialog.open) this.dialog.close();
    }

    private setBusy(busy: boolean): void {
        this.busy = busy;
        this.saveButton.disabled = busy;
        this.cancelButton.disabled = busy;
        this.closeButton.disabled = busy;
        this.deleteButton.disabled = busy;
        this.saveButton.classList.toggle("is-busy", busy);
        this.dialog.setAttribute("aria-busy", String(busy));
    }

    private setError(message: string | null): void {
        this.errorBox.hidden = !message;
        this.errorText.textContent = message ?? "";
        if (message) this.errorBox.focus();
    }

    private clearError(): void {
        if (this.errorBox.hidden) return;
        this.setError(null);
    }
}
