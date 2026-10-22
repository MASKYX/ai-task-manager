import type {
    CalendarAction,
    ChatMessage,
    ExecutionResult,
    Proposal,
} from "./types.ts";
import { HISTORY_CHARACTER_LIMIT, HISTORY_MESSAGE_LIMIT } from "./types.ts";

export class ConversationClearedError extends Error {
    constructor() {
        super("The conversation was cleared.");
        this.name = "ConversationClearedError";
    }
}

type PlanRequest = (
    preferences: string,
    request: string,
    history: ChatMessage[],
    signal?: AbortSignal,
) => Promise<Proposal>;

type ExecuteRequest = (
    actions: CalendarAction[],
    signal?: AbortSignal,
) => Promise<ExecutionResult>;

export function trimHistory(messages: ChatMessage[]): ChatMessage[] {
    const trimmed: ChatMessage[] = [];
    let characters = 0;

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message) continue;
        if (trimmed.length >= HISTORY_MESSAGE_LIMIT) break;

        const nextCharacters = characters + message.content.length;
        if (trimmed.length > 0 && nextCharacters > HISTORY_CHARACTER_LIMIT) break;

        trimmed.unshift(message);
        characters = nextCharacters;
    }

    return trimmed;
}

function actionName(action: CalendarAction): string {
    if (action.summary?.trim()) return action.summary.trim();
    if (action.eventId) return action.eventId;
    return action.type === "CREATE_EVENT" ? "new event" : "event";
}

export function executionSummary(result: ExecutionResult, actions: CalendarAction[]): string {
    const total = result.executed + result.failed;
    const lines: string[] = [];

    if (result.failed === 0) {
        lines.push(result.executed === 1 ? "Applied 1 change." : `Applied ${result.executed} changes.`);
    } else if (result.executed === 0) {
        lines.push(total === 1 ? "The change could not be applied." : "No changes were applied.");
    } else {
        lines.push(`Applied ${result.executed} of ${total} changes.`);
    }

    for (const item of Array.isArray(result.results) ? result.results : []) {
        if (item.success) continue;
        const action = actions[item.index];
        lines.push(`• ${action ? actionName(action) : "Change"}: ${item.message}`);
    }

    return lines.join("\n");
}

export class BotSession {
    private messages: ChatMessage[];
    private pending: CalendarAction[] | null = null;
    private generation = 0;

    private readonly planRequest: PlanRequest;
    private readonly executeRequest: ExecuteRequest;

    constructor(
        planRequest: PlanRequest,
        executeRequest: ExecuteRequest,
        initialHistory: ChatMessage[] = [],
    ) {
        this.planRequest = planRequest;
        this.executeRequest = executeRequest;
        this.messages = trimHistory(initialHistory);
    }

    get history(): ChatMessage[] {
        return [...this.messages];
    }

    get pendingActions(): CalendarAction[] | null {
        return this.pending;
    }

    async propose(preferences: string, request: string, signal?: AbortSignal): Promise<Proposal> {
        const text = request.trim();
        if (!text) throw new Error("Enter a request first.");

        this.dismiss();
        const history = [...this.messages];
        const generation = this.generation;
        this.add({ role: "USER", content: text });

        try {
            const proposal = await this.planRequest(preferences.trim(), text, history, signal);
            if (generation !== this.generation) throw new ConversationClearedError();
            if (!proposal || typeof proposal.comment !== "string" || !proposal.comment.trim()
                || !Array.isArray(proposal.actions)) {
                throw new Error("The assistant returned an invalid proposal. Please try again.");
            }

            this.pending = proposal.actions.length > 0 ? proposal.actions : null;
            this.add({
                role: "ASSISTANT",
                content: proposal.comment.trim(),
                actions: proposal.actions,
            });
            return proposal;
        } catch (error) {
            if (generation === this.generation) this.removeLastUserMessage(text);
            throw error;
        }
    }

    dismiss(): boolean {
        if (!this.pending) return false;

        this.pending = null;
        this.add({ role: "ASSISTANT", content: "The proposed changes were dismissed." });
        return true;
    }

    discardPending(): boolean {
        if (!this.pending) return false;
        this.pending = null;
        return true;
    }

    addNotice(content: string): void {
        this.add({ role: "ASSISTANT", content });
    }

    clearHistory(): void {
        this.generation += 1;
        this.pending = null;
        this.messages = [];
    }

    async confirm(actions: CalendarAction[], signal?: AbortSignal): Promise<ExecutionResult> {
        if (this.pending !== actions) throw new Error("This proposal is no longer active.");

        const generation = this.generation;
        const result = await this.executeRequest(actions, signal);
        if (generation !== this.generation) throw new ConversationClearedError();

        const results = Array.isArray(result.results) ? result.results : [];
        const failed = results
            .filter((item) => !item.success)
            .map((item) => actions[item.index])
            .filter((action): action is CalendarAction => Boolean(action));

        this.pending = result.failed > 0
            ? failed.length > 0 ? failed : actions
            : null;
        this.add({ role: "ASSISTANT", content: executionSummary(result, actions) });
        return result;
    }

    private add(message: ChatMessage): void {
        this.messages = trimHistory([...this.messages, message]);
    }

    private removeLastUserMessage(request: string): void {
        const last = this.messages.at(-1);
        if (last?.role === "USER" && last.content === request) this.messages.pop();
    }
}
