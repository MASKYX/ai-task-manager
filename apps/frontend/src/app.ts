import "./styles.css";
import { errorMessage, ApiClient } from "./api.ts";
import {
    getAccessToken,
    getUserInitial,
    getUserLabel,
    loadSession,
    redirectToSignIn,
    renewAccessToken,
    signOut,
    storageScopeFor,
    type AppSession,
} from "./auth.ts";
import {
    addDays,
    addMonths,
    atNoon,
    dayKey,
    eventIntersectsMonth,
    groupEventsByDay,
    isInMonth,
    monthRange,
    moveEvent,
    startOfMonth,
    todayKey,
} from "./calendar.ts";
import { formatCount, formatDateLong, formatMonth } from "./format.ts";
import type { CalendarEvent, CalendarProvider, EventInput } from "./types.ts";
import { EventDialog } from "./ui/eventDialog.ts";
import { BotPanel } from "./ui/botPanel.ts";
import {
    announce,
    isMobileLayout,
    query,
    queryAll,
    setPressed,
    setText,
} from "./ui/dom.ts";
import { hydrateIcons } from "./ui/icons.ts";
import { renderAgenda } from "./ui/agendaView.ts";
import { renderCalendar, renderSelectedDay } from "./ui/calendarView.ts";
import { showToast } from "./ui/toast.ts";

type PanelName = "calendar" | "agenda" | "assistant";

class CalendarApp {
    private readonly session: AppSession;
    private readonly api: ApiClient;
    private readonly bot: BotPanel;
    private readonly eventDialog: EventDialog;

    private readonly appElement = query("#app");
    private readonly mainElement = query("#main-content");
    private readonly monthLabel = query("#month-label");
    private readonly calendarSubtitle = query("#calendar-subtitle");
    private readonly agendaSubtitle = query("#agenda-subtitle");
    private readonly calendarGrid = query("#calendar-grid");
    private readonly agendaContent = query("#agenda-content");
    private readonly selectedDayPanel = query("#selected-day");
    private readonly calendarStatus = query("#calendar-status");
    private readonly calendarStatusText = query("#calendar-status-text");
    private readonly accountButton = query<HTMLButtonElement>("#account-button");
    private readonly accountMenu = query("#account-menu");
    private readonly signOutButton = query<HTMLButtonElement>("#sign-out");
    private readonly providerLocal = query<HTMLButtonElement>("#provider-local");
    private readonly providerGoogle = query<HTMLButtonElement>("#provider-google");
    private readonly panelTabs = queryAll<HTMLButtonElement>("#panel-tabs [data-panel]");
    private readonly mobileQuery = window.matchMedia("(max-width: 767px)");

    private viewDate: Date;
    private selectedDate: Date;
    private events: CalendarEvent[] = [];
    private provider: CalendarProvider | null = null;
    private loading = true;
    private loadError: string | null = null;
    private providerBusy = false;
    private providerLoading = true;
    private loadController: AbortController | null = null;
    private loadSequence = 0;
    private pendingFocusKey: string | null = null;

    constructor(session: AppSession) {
        this.session = session;
        const now = new Date();
        this.viewDate = startOfMonth(now);
        this.selectedDate = atNoon(now);

        this.api = new ApiClient({
            getAccessToken: () => this.session.kind === "cognito"
                ? getAccessToken()
                : Promise.resolve(null),
            renewAccessToken: () => this.session.kind === "cognito"
                ? renewAccessToken()
                : Promise.resolve(false),
            onUnauthorized: () => redirectToSignIn("expired"),
        });

        this.bot = new BotPanel({
            api: this.api,
            scope: storageScopeFor(this.session),
            onEventsChanged: () => this.loadEvents(),
        });

        this.eventDialog = new EventDialog({
            onSave: (id, input) => this.saveEvent(id, input),
            onDelete: (event) => this.deleteEvent(event),
        });
    }

    start(): void {
        this.appElement.dataset.session = this.session.kind;
        query("#provider-switch").hidden = this.session.kind === "demo";
        this.updateAccount();
        this.bindEvents();
        this.updateMonthHeader();
        this.renderProvider();
        this.render();
        this.bot.start();
        this.setActivePanel("calendar", false);

        if (this.session.kind === "demo") {
            this.provider = "LOCAL";
            this.providerLoading = false;
            this.renderProvider();
        } else {
            void this.loadProvider();
        }
        void this.loadEvents();
    }

    private bindEvents(): void {
        query("#prev-month").addEventListener("click", () => this.changeMonth(-1));
        query("#next-month").addEventListener("click", () => this.changeMonth(1));
        query("#today-button").addEventListener("click", () => this.goToToday());

        this.providerLocal.addEventListener("click", () => void this.switchProvider("LOCAL"));
        this.providerGoogle.addEventListener("click", () => void this.switchProvider("GOOGLE"));

        for (const button of this.panelTabs) {
            button.addEventListener("click", () => {
                this.setActivePanel(button.dataset.panel as PanelName);
            });
        }

        for (const button of queryAll<HTMLButtonElement>("[data-add-event]")) {
            button.addEventListener("click", () => this.openCreateForSelectedDay());
        }

        query("#calendar-retry").addEventListener("click", () => {
            if (this.provider === null) void this.loadProvider();
            void this.loadEvents();
        });

        this.accountButton.addEventListener("click", (event) => {
            event.stopPropagation();
            this.toggleAccountMenu(this.accountMenu.hidden);
        });
        this.accountMenu.addEventListener("click", (event) => event.stopPropagation());
        document.addEventListener("click", () => this.toggleAccountMenu(false));
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape" && !this.accountMenu.hidden) {
                this.toggleAccountMenu(false);
                this.accountButton.focus();
            }
        });

        this.signOutButton.addEventListener("click", () => void this.handleSignOut());
        this.mobileQuery.addEventListener("change", () => {
            this.updateCalendarSubtitle();
            this.renderSelectedDay();
        });
    }

    private setActivePanel(panel: PanelName, announceChange = true): void {
        this.mainElement.dataset.activePanel = panel;

        for (const button of this.panelTabs) {
            setPressed(button, button.dataset.panel === panel);
        }

        if (announceChange) {
            announce(`${panel === "assistant" ? "Assistant" : panel[0].toUpperCase() + panel.slice(1)} section`);
        }
    }

    private updateAccount(): void {
        const { kind } = this.session;
        const accountEmail = query("#account-email");
        const accountInitial = query("#account-initial");
        const menuEmail = query("#account-menu-email");
        const menuKind = query("#account-menu-kind");
        const sessionBadge = query("#session-badge");

        if (this.session.kind === "cognito") {
            const user = this.session.user;
            const label = getUserLabel(user);
            setText(accountEmail, label);
            setText(accountInitial, getUserInitial(user));
            setText(menuEmail, label);
            setText(menuKind, "Signed in with Cognito");
            sessionBadge.hidden = true;
        } else {
            setText(accountEmail, "Demo session");
            setText(accountInitial, "D");
            setText(menuEmail, "Demo session");
            setText(menuKind, "Temporary local calendar");
            sessionBadge.hidden = false;
        }

        this.accountButton.setAttribute("aria-label", `Account menu for ${kind === "demo" ? "demo session" : getUserLabel(this.session.user)}`);
    }

    private toggleAccountMenu(open: boolean): void {
        this.accountMenu.hidden = !open;
        this.accountButton.setAttribute("aria-expanded", String(open));
    }

    private async handleSignOut(): Promise<void> {
        this.signOutButton.disabled = true;
        try {
            await signOut(this.session);
        } catch (error) {
            this.signOutButton.disabled = false;
            showToast(errorMessage(error), "error");
        }
    }

    private async loadProvider(): Promise<void> {
        this.providerLoading = true;
        this.renderProvider();
        try {
            this.provider = await this.api.getProvider();
        } catch (error) {
            showToast(errorMessage(error), "error");
        } finally {
            this.providerLoading = false;
            this.renderProvider();
        }
    }

    private renderProvider(): void {
        const demo = this.session.kind === "demo";
        this.providerGoogle.hidden = demo;

        const busy = this.providerBusy || this.providerLoading;
        this.providerLocal.disabled = busy || demo;
        this.providerGoogle.disabled = busy || demo;
        this.providerLocal.classList.toggle("is-busy", this.providerBusy);
        this.providerGoogle.classList.toggle("is-busy", this.providerBusy);

        setPressed(this.providerLocal, this.provider === "LOCAL");
        setPressed(this.providerGoogle, this.provider === "GOOGLE");
    }

    private async switchProvider(provider: CalendarProvider): Promise<void> {
        if (this.session.kind === "demo" || this.providerBusy || provider === this.provider) return;
        if (this.bot.isWorking) {
            showToast("Wait for the assistant to finish before switching calendars.", "info");
            return;
        }

        this.providerBusy = true;
        this.renderProvider();
        try {
            this.provider = await this.api.setProvider(provider);
            this.bot.onProviderChanged(provider === "GOOGLE" ? "Google Calendar" : "local calendar");
            showToast(`Calendar switched to ${provider === "GOOGLE" ? "Google" : "local"}.`, "success");
            await this.loadEvents();
        } catch (error) {
            showToast(errorMessage(error), "error");
        } finally {
            this.providerBusy = false;
            this.renderProvider();
        }
    }

    private changeMonth(offset: number): void {
        this.viewDate = addMonths(this.viewDate, offset);
        this.selectedDate = this.defaultSelectedDate();
        this.pendingFocusKey = null;
        this.updateMonthHeader();
        void this.loadEvents();
        announce(formatMonth(this.viewDate));
    }

    private goToToday(): void {
        const now = new Date();
        this.viewDate = startOfMonth(now);
        this.selectedDate = atNoon(now);
        this.pendingFocusKey = todayKey();
        this.updateMonthHeader();
        void this.loadEvents();
        announce("Today");
    }

    private navigateToDay(date: Date): void {
        this.viewDate = startOfMonth(date);
        this.selectedDate = atNoon(date);
        this.pendingFocusKey = dayKey(date);
        this.updateMonthHeader();
        void this.loadEvents();
    }

    private defaultSelectedDate(): Date {
        const today = new Date();
        return isInMonth(today, this.viewDate) ? atNoon(today) : atNoon(startOfMonth(this.viewDate));
    }

    private updateMonthHeader(): void {
        setText(this.monthLabel, formatMonth(this.viewDate));
        document.title = `TaskAI · ${formatMonth(this.viewDate)}`;
        this.updateCalendarSubtitle();
    }

    private updateCalendarSubtitle(): void {
        const count = this.monthEvents().length;
        if (this.loading) {
            setText(this.calendarSubtitle, "Loading events…");
            setText(this.agendaSubtitle, `${formatMonth(this.viewDate)} · Loading…`);
            return;
        }
        if (this.loadError) {
            setText(this.calendarSubtitle, "Events unavailable");
            setText(this.agendaSubtitle, `${formatMonth(this.viewDate)} · Unavailable`);
            return;
        }

        const suffix = isMobileLayout() ? "Tap a day to see its schedule." : "Click a day to add an event.";
        setText(this.calendarSubtitle, `${formatCount(count, "event")} this month · ${suffix}`);
        setText(this.agendaSubtitle, `${formatMonth(this.viewDate)} · ${formatCount(count, "event")}`);
    }

    private monthEvents(): CalendarEvent[] {
        return this.events.filter((event) => eventIntersectsMonth(event, this.viewDate));
    }

    private async loadEvents(): Promise<void> {
        this.loadController?.abort();
        const controller = new AbortController();
        this.loadController = controller;
        const sequence = ++this.loadSequence;

        this.loading = true;
        this.loadError = null;
        this.setCalendarError(null);
        this.render();
        this.updateCalendarSubtitle();

        try {
            const range = monthRange(this.viewDate);
            const events = await this.api.listEvents(
                addDays(range.start, -1),
                addDays(range.end, 1),
                controller.signal,
            );
            if (sequence !== this.loadSequence) return;

            this.events = Array.isArray(events) ? events : [];
            this.loading = false;
            this.render();
            this.updateCalendarSubtitle();
            this.focusPendingDay();
        } catch (error) {
            if (sequence !== this.loadSequence || controller.signal.aborted) return;

            this.events = [];
            this.loading = false;
            this.loadError = errorMessage(error);
            this.render();
            this.updateCalendarSubtitle();
            this.setCalendarError(this.loadError);
            announce("The calendar could not be loaded.");
        }
    }

    private render(): void {
        renderCalendar(this.calendarGrid, {
            viewDate: this.viewDate,
            events: this.events,
            selectedDate: this.selectedDate,
            loading: this.loading,
            onSelectDay: (date) => this.selectDay(date),
            onOpenEvent: (event) => this.eventDialog.openEdit(event),
            onMoveEvent: (event, date) => void this.moveEvent(event, date),
            onNavigateDay: (date) => this.navigateToDay(date),
        });

        this.renderSelectedDay();
        this.renderAgenda();
        this.updateCalendarSubtitle();
    }

    private renderSelectedDay(): void {
        const selectedEvents = groupEventsByDay(this.events).get(dayKey(this.selectedDate)) ?? [];
        renderSelectedDay(
            this.selectedDayPanel,
            this.selectedDate,
            selectedEvents,
            this.loading,
            (event) => this.eventDialog.openEdit(event),
        );
    }

    private renderAgenda(): void {
        renderAgenda(this.agendaContent, {
            viewDate: this.viewDate,
            events: this.events,
            loading: this.loading,
            error: this.loadError,
            onOpenEvent: (event) => this.eventDialog.openEdit(event),
            onAdd: () => this.openCreateForSelectedDay(),
            onRetry: () => void this.loadEvents(),
        });
    }

    private selectDay(date: Date): void {
        const mobile = isMobileLayout();
        this.selectedDate = atNoon(date);
        this.render();
        announce(formatDateLong(date));

        if (mobile) {
            this.calendarGrid
                .querySelector<HTMLButtonElement>(`button.day-number[data-date="${dayKey(date)}"]`)
                ?.focus();
        } else {
            this.eventDialog.openCreate(date);
        }
    }

    private openCreateForSelectedDay(): void {
        const date = isInMonth(this.selectedDate, this.viewDate)
            ? this.selectedDate
            : atNoon(startOfMonth(this.viewDate));
        this.eventDialog.openCreate(date);
    }

    private focusPendingDay(): void {
        if (!this.pendingFocusKey) return;
        const button = this.calendarGrid.querySelector<HTMLButtonElement>(
            `button.day-number[data-date="${this.pendingFocusKey}"]`,
        );
        if (button) {
            button.focus();
            this.pendingFocusKey = null;
        }
    }

    private setCalendarError(message: string | null): void {
        this.calendarStatus.hidden = !message;
        this.calendarStatusText.textContent = message ?? "";
    }

    private async saveEvent(id: string | null, input: EventInput): Promise<void> {
        if (id) {
            await this.api.updateEvent(id, input);
            showToast("Event updated.", "success");
        } else {
            await this.api.createEvent(input);
            showToast("Event created.", "success");
        }
        this.bot.onCalendarChanged();
        void this.loadEvents();
    }

    private async deleteEvent(event: CalendarEvent): Promise<void> {
        await this.api.deleteEvent(event.id);
        this.bot.onCalendarChanged();
        showToast("Event deleted.", "success");
        void this.loadEvents();
    }

    private async moveEvent(event: CalendarEvent, date: Date): Promise<void> {
        try {
            const input = moveEvent(event, date);
            await this.api.updateEvent(event.id, input);
            this.bot.onCalendarChanged();
            showToast("Event rescheduled.", "success");
            void this.loadEvents();
        } catch (error) {
            showToast(errorMessage(error), "error");
        }
    }
}

async function boot(): Promise<void> {
    hydrateIcons();
    const bootScreen = document.getElementById("boot");
    const appElement = document.getElementById("app");

    try {
        const session = await loadSession();
        if (!session) {
            redirectToSignIn("session");
            return;
        }

        const app = new CalendarApp(session);
        app.start();

        if (bootScreen) bootScreen.hidden = true;
        if (appElement) {
            appElement.hidden = false;
            appElement.classList.add("is-ready");
        }
    } catch (error) {
        const message = errorMessage(error);
        const bootMessage = document.getElementById("boot-message");
        const bootSpinner = document.getElementById("boot-spinner");
        const bootError = document.getElementById("boot-error");
        const bootErrorMessage = document.getElementById("boot-error-message");

        if (bootMessage) bootMessage.hidden = true;
        if (bootSpinner) bootSpinner.hidden = true;
        if (bootErrorMessage) bootErrorMessage.textContent = message;
        if (bootError) bootError.hidden = false;
    }
}

const retryButton = document.getElementById("boot-retry");
retryButton?.addEventListener("click", () => window.location.reload());

void boot();
