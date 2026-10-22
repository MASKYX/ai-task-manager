import { ApiClient, ApiError, errorMessage, isAbortError } from "../api.ts";
import { BotSession, ConversationClearedError } from "../botSession.ts";
import {
    PREFERENCES_CHARACTER_LIMIT,
    REQUEST_CHARACTER_LIMIT,
    type AiQuota,
    type CalendarAction,
    type ChatMessage,
} from "../types.ts";
import type { StorageScope } from "../storage.ts";
import {
    loadChatHistory,
    loadPreferences,
    saveChatHistory,
    savePreferences,
} from "../storage.ts";
import {
    formatAction,
    formatCount,
    formatQuota,
    formatQuotaTooltip,
} from "../format.ts";
import { create, debounce, query, setText } from "./dom.ts";
import { icon } from "./icons.ts";
import { showToast } from "./toast.ts";

type BotPanelOptions = {
    api: ApiClient;
    scope: StorageScope | null;
    onEventsChanged: () => Promise<void>;
};

const SUGGESTIONS = [
    "Plan a focused week around my existing events.",
    "Find a free hour tomorrow for deep work.",
    "Reschedule my afternoon to leave earlier.",
];

export class BotPanel {
    private readonly api: ApiClient;
    private readonly scope: StorageScope | null;
    private readonly onEventsChanged: () => Promise<void>;
    private readonly session: BotSession;

    private readonly transcript: HTMLElement;
    private readonly form: HTMLFormElement;
    private readonly input: HTMLTextAreaElement;
    private readonly sendButton: HTMLButtonElement;
    private readonly clearButton: HTMLButtonElement;
    private readonly errorBox: HTMLElement;
    private readonly errorText: HTMLElement;
    private readonly errorDismiss: HTMLButtonElement;
    private readonly statusRegion: HTMLElement;
    private readonly quotaLabel: HTMLElement;
    private readonly quotaBanner: HTMLElement;
    private readonly quotaInfo: HTMLButtonElement;
    private readonly quotaTooltip: HTMLElement;
    private readonly preferencesInput: HTMLTextAreaElement;
    private readonly preferencesCount: HTMLElement;

    private quota: AiQuota | null = null;
    private quotaVersion = 0;
    private busy = false;
    private applying = false;
    private planController: AbortController | null = null;
    private storageWarningShown = false;
    private firstRender = true;

    private readonly persistPreferences = debounce(() => {
        if (!this.scope) return;
        if (!savePreferences(this.scope, this.preferencesInput.value)) {
            this.warnStorageOnce();
        }
    }, 350);

    constructor(options: BotPanelOptions) {
        this.api = options.api;
        this.scope = options.scope;
        this.onEventsChanged = options.onEventsChanged;

        this.transcript = query("#chat-transcript");
        this.form = query("#chat-form");
        this.input = query("#chat-input");
        this.sendButton = query("#chat-send");
        this.clearButton = query("#chat-clear");
        this.errorBox = query("#chat-error");
        this.errorText = query("#chat-error-text");
        this.errorDismiss = query("#chat-error-dismiss");
        this.statusRegion = query("#chat-status");
        this.quotaLabel = query("#quota-label");
        this.quotaBanner = query("#quota-banner");
        this.quotaInfo = query("#quota-info");
        this.quotaTooltip = query("#quota-tooltip");
        this.preferencesInput = query("#preferences-input");
        this.preferencesCount = query("#preferences-count");

        const initialHistory = this.scope ? loadChatHistory(this.scope) : [];
        this.session = new BotSession(
            (preferences, request, history, signal) =>
                this.api.plan(preferences, request, history, signal),
            (actions, signal) => this.api.execute(actions, signal),
            initialHistory,
        );

        this.input.maxLength = REQUEST_CHARACTER_LIMIT;
        this.preferencesInput.maxLength = PREFERENCES_CHARACTER_LIMIT;
    }

    get isWorking(): boolean {
        return this.busy || this.applying;
    }

    start(): void {
        this.preferencesInput.value = this.scope ? loadPreferences(this.scope) : "";
        this.updatePreferencesCount();
        this.bindEvents();
        this.render();
        this.updateComposerState();
        void this.refreshQuota();
    }

    focusInput(): void {
        this.input.focus();
    }

    onProviderChanged(label: string): void {
        if (!this.session.discardPending()) return;
        this.session.addNotice(`The calendar was switched to ${label}. The previous proposal was dismissed.`);
        this.saveHistory();
        this.render();
    }

    onCalendarChanged(): void {
        if (!this.session.discardPending()) return;
        this.session.addNotice("The calendar changed. The previous proposal was dismissed.");
        this.saveHistory();
        this.render();
    }

    private bindEvents(): void {
        this.form.addEventListener("submit", (event) => {
            event.preventDefault();
            void this.send();
        });

        this.input.addEventListener("input", () => {
            this.resizeInput();
            this.updateComposerState();
            this.clearError();
        });

        this.input.addEventListener("keydown", (event) => {
            if (event.key !== "Enter" || event.shiftKey || event.isComposing) return;
            event.preventDefault();
            void this.send();
        });

        this.clearButton.addEventListener("click", () => this.clearChat());
        this.errorDismiss.addEventListener("click", () => this.clearError());

        this.preferencesInput.addEventListener("input", () => {
            this.updatePreferencesCount();
            this.persistPreferences();
        });

        this.quotaInfo.addEventListener("focus", () => this.quotaTooltip.classList.add("is-visible"));
        this.quotaInfo.addEventListener("blur", () => this.quotaTooltip.classList.remove("is-visible"));
        this.quotaInfo.addEventListener("mouseenter", () => this.quotaTooltip.classList.add("is-visible"));
        this.quotaInfo.addEventListener("mouseleave", () => this.quotaTooltip.classList.remove("is-visible"));
    }

    private async refreshQuota(): Promise<void> {
        const version = ++this.quotaVersion;
        try {
            const quota = await this.api.getQuota();
            if (version !== this.quotaVersion) return;
            this.updateQuota(quota);
        } catch (error) {
            if (isAbortError(error) || this.quota) return;
            this.quotaLabel.textContent = "Requests unavailable";
            this.quotaInfo.setAttribute("aria-label", "AI request limit information");
            this.quotaTooltip.textContent = formatQuotaTooltip(null);
        }
    }

    private updateQuota(quota: AiQuota): void {
        this.quotaVersion += 1;
        this.quota = quota;
        this.quotaLabel.textContent = formatQuota(quota);
        this.quotaTooltip.textContent = formatQuotaTooltip(quota);
        this.quotaInfo.setAttribute("aria-label", `AI request limit. ${formatQuotaTooltip(quota)}`);
        this.quotaBanner.hidden = quota.remaining > 0;
        this.updateComposerState();
    }

    private updateComposerState(): void {
        const exhausted = this.quota?.remaining === 0;
        this.sendButton.disabled = this.busy || this.applying || exhausted || !this.input.value.trim();
        this.clearButton.disabled = this.applying;
        this.input.disabled = this.applying;
    }

    private resizeInput(): void {
        this.input.style.height = "auto";
        this.input.style.height = `${Math.min(this.input.scrollHeight, 132)}px`;
    }

    private async send(): Promise<void> {
        const request = this.input.value.trim();
        if (!request || this.busy || this.applying || this.quota?.remaining === 0) {
            if (this.quota?.remaining === 0) this.quotaBanner.hidden = false;
            this.input.focus();
            return;
        }

        this.clearError();
        if (this.session.pendingActions) {
            this.session.dismiss();
            this.saveHistory();
        }

        this.busy = true;
        this.input.value = "";
        this.resizeInput();
        this.updateComposerState();

        const controller = new AbortController();
        this.planController = controller;
        const proposalPromise = this.session.propose(
            this.preferencesInput.value,
            request,
            controller.signal,
        );
        this.render();
        this.setStatus("Assistant is thinking");
        this.transcript.scrollTop = this.transcript.scrollHeight;

        try {
            const proposal = await proposalPromise;
            if (proposal.quota) this.updateQuota(proposal.quota);
            this.saveHistory();
            this.setStatus(proposal.actions.length > 0 ? "Proposal ready for review" : "Assistant replied");
        } catch (error) {
            if (this.planController !== controller) return;
            if (isAbortError(error) || error instanceof ConversationClearedError) {
                return;
            }

            if (error instanceof ApiError && error.code === "DAILY_AI_LIMIT_REACHED") {
                if (this.quota) {
                    this.updateQuota({ remaining: 0, limit: this.quota.limit });
                } else {
                    this.quotaBanner.hidden = false;
                }
                void this.refreshQuota();
            } else {
                void this.refreshQuota();
            }

            if (!this.input.value.trim()) this.input.value = request;
            this.resizeInput();
            this.setError(errorMessage(error));
            this.setStatus("The assistant could not answer");
        } finally {
            if (this.planController === controller) {
                this.planController = null;
                this.busy = false;
                this.render();
                this.updateComposerState();
                this.input.focus();
            }
        }
    }

    private async applyProposal(actions: CalendarAction[]): Promise<void> {
        if (this.applying || this.session.pendingActions !== actions) return;

        this.applying = true;
        this.updateComposerState();
        this.render();
        this.setStatus("Applying changes");

        try {
            const result = await this.session.confirm(actions);
            this.saveHistory();
            this.render();

            if (result.failed > 0) {
                showToast("Some changes could not be applied. Review the remaining actions.", "error");
            } else {
                showToast(formatCount(result.executed, "change") + " applied.", "success");
            }
            this.setStatus(result.failed > 0 ? "Some changes could not be applied" : "Changes applied");

            try {
                await this.onEventsChanged();
            } catch {
                showToast("Changes were applied, but the calendar could not be refreshed.", "error");
            }
        } catch (error) {
            if (!(error instanceof ConversationClearedError)) {
                this.setError(errorMessage(error));
                this.setStatus("Changes could not be applied");
            }
        } finally {
            this.applying = false;
            this.render();
            this.updateComposerState();
        }
    }

    private dismissProposal(): void {
        if (!this.session.dismiss()) return;
        this.saveHistory();
        this.render();
        this.setStatus("Proposal dismissed");
    }

    private clearChat(): void {
        this.planController?.abort();
        this.planController = null;
        this.session.clearHistory();
        this.clearError();
        if (this.scope) saveChatHistory(this.scope, []);
        this.input.value = "";
        this.resizeInput();
        this.busy = false;
        this.render();
        this.transcript.scrollTop = 0;
        this.updateComposerState();
        this.setStatus("Conversation cleared");
        this.input.focus();
    }

    private render(): void {
        const stickToBottom = this.firstRender || this.isNearBottom();
        const previousScroll = this.transcript.scrollTop;
        this.transcript.replaceChildren();

        const history = this.session.history;
        if (history.length === 0 && !this.busy) {
            this.transcript.appendChild(this.renderWelcome());
        } else {
            history.forEach((message, index) => {
                const hasPendingProposal = Boolean(this.session.pendingActions)
                    && index === history.length - 1;
                this.transcript.appendChild(this.renderMessage(message, !hasPendingProposal));
            });
            if (this.busy) this.transcript.appendChild(this.renderTyping());
            if (this.session.pendingActions) {
                this.transcript.appendChild(this.renderProposal(this.session.pendingActions));
            }
        }

        if (stickToBottom) {
            this.transcript.scrollTop = this.transcript.scrollHeight;
            this.firstRender = false;
        } else {
            this.transcript.scrollTop = previousScroll;
        }
    }

    private renderWelcome(): HTMLElement {
        const welcome = create("div", "chat-welcome");
        const badge = create("div", "chat-welcome-icon");
        badge.appendChild(icon("sparkles", 26));

        const suggestions = create("div", "suggestion-list");
        for (const suggestion of SUGGESTIONS) {
            const button = create("button", "suggestion");
            button.type = "button";
            button.textContent = suggestion;
            button.addEventListener("click", () => {
                this.input.value = suggestion;
                this.resizeInput();
                this.updateComposerState();
                void this.send();
            });
            suggestions.appendChild(button);
        }

        welcome.append(
            badge,
            create("h3", "chat-welcome-title", "How can I help?"),
            create(
                "p",
                "chat-welcome-copy",
                "Ask for a plan or a change. I will show you the details before anything is applied.",
            ),
            suggestions,
        );
        return welcome;
    }

    private renderMessage(message: ChatMessage, showActions = true): HTMLElement {
        const row = create("div", `chat-row chat-row--${message.role === "USER" ? "user" : "assistant"}`);

        if (message.role === "ASSISTANT") {
            const avatar = create("span", "chat-avatar");
            avatar.appendChild(icon("sparkles", 16));
            row.appendChild(avatar);
        }

        const bubble = create("div", "chat-bubble");
        const meta = create("span", "chat-meta", message.role === "USER" ? "You" : "TaskAI");
        const text = create("p", "chat-text", message.content);
        bubble.append(meta, text);

        if (showActions && message.role === "ASSISTANT" && message.actions?.length) {
            const list = create("ul", "chat-action-list");
            for (const action of message.actions) {
                list.appendChild(create("li", "", formatAction(action)));
            }
            bubble.appendChild(list);
        }

        row.appendChild(bubble);
        return row;
    }

    private renderTyping(): HTMLElement {
        const row = create("div", "chat-row chat-row--assistant");
        const avatar = create("span", "chat-avatar");
        avatar.appendChild(icon("sparkles", 16));
        const bubble = create("div", "chat-bubble chat-bubble--typing");
        bubble.setAttribute("aria-label", "Assistant is thinking");
        bubble.append(
            create("span", "typing-dot"),
            create("span", "typing-dot"),
            create("span", "typing-dot"),
        );
        row.append(avatar, bubble);
        return row;
    }

    private renderProposal(actions: CalendarAction[]): HTMLElement {
        const card = create("div", "proposal");
        card.setAttribute("role", "group");
        card.setAttribute("aria-label", "Proposed calendar changes");

        const heading = create(
            "h3",
            "proposal-title",
            `${formatCount(actions.length, "proposed change")}`,
        );
        const list = create("ul", "proposal-list");
        for (const action of actions) {
            const item = create("li", "proposal-item");
            item.appendChild(icon(action.type === "DELETE_EVENT" ? "trash" : "calendar", 16));
            item.appendChild(create("span", "", formatAction(action)));
            list.appendChild(item);
        }

        const note = create("p", "proposal-note", "Nothing changes until you apply.");
        const buttons = create("div", "proposal-actions");

        const dismiss = create("button", "btn btn-secondary btn-sm");
        dismiss.type = "button";
        dismiss.textContent = "Dismiss";
        dismiss.disabled = this.applying;
        dismiss.addEventListener("click", () => this.dismissProposal());

        const apply = create("button", "btn btn-primary btn-sm");
        apply.type = "button";
        apply.textContent = this.applying ? "Applying…" : "Apply changes";
        apply.disabled = this.applying;
        apply.classList.toggle("is-busy", this.applying);
        apply.addEventListener("click", () => {
            void this.applyProposal(actions);
        });

        buttons.append(dismiss, apply);
        card.append(heading, list, note, buttons);
        return card;
    }

    private isNearBottom(): boolean {
        const distance = this.transcript.scrollHeight - this.transcript.scrollTop - this.transcript.clientHeight;
        return distance < 80;
    }

    private saveHistory(): void {
        if (!this.scope) return;
        if (!saveChatHistory(this.scope, this.session.history)) this.warnStorageOnce();
    }

    private warnStorageOnce(): void {
        if (this.storageWarningShown) return;
        this.storageWarningShown = true;
        showToast("Chat history can't be saved on this device. It will last for this session only.", "error");
    }

    private updatePreferencesCount(): void {
        setText(
            this.preferencesCount,
            `${this.preferencesInput.value.length} / ${PREFERENCES_CHARACTER_LIMIT}`,
        );
    }

    private setError(message: string | null): void {
        this.errorBox.hidden = !message;
        this.errorText.textContent = message ?? "";
    }

    private clearError(): void {
        if (!this.errorBox.hidden) this.setError(null);
    }

    private setStatus(message: string): void {
        this.statusRegion.textContent = message;
    }
}
