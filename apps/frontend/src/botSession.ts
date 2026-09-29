export type CalendarAction = {
    type: 'CREATE_EVENT' | 'UPDATE_EVENT' | 'DELETE_EVENT';
    eventId?: string;
    summary?: string;
    description?: string;
    startDateTime?: string;
    endDateTime?: string;
    allDay?: boolean;
};

export type ChatMessage = {
    role: 'USER' | 'ASSISTANT';
    content: string;
    actions?: CalendarAction[];
};

export type AiQuota = { remaining: number; limit: number };
export type Proposal = { comment: string; actions: CalendarAction[]; quota?: AiQuota };
export function quotaView(quota: AiQuota) {
    return {
        label: `${quota.remaining} / ${quota.limit} requests`,
        exhausted: quota.remaining === 0,
    };
}
export type ActionResult = { index: number; success: boolean; message: string };
export type ExecutionResult = {
    message: string;
    executed: number;
    failed: number;
    results: ActionResult[];
};

export class BotSession {
    pendingActions: CalendarAction[] | null = null;
    history: ChatMessage[];

    private readonly planRequest: (preferences: string, request: string, history: ChatMessage[]) => Promise<Proposal>;
    private readonly executeRequest: (actions: CalendarAction[]) => Promise<ExecutionResult>;
    private generation = 0;

    constructor(
        planRequest: (preferences: string, request: string, history: ChatMessage[]) => Promise<Proposal>,
        executeRequest: (actions: CalendarAction[]) => Promise<ExecutionResult>,
        initialHistory: ChatMessage[] = []
    ) {
        this.planRequest = planRequest;
        this.executeRequest = executeRequest;
        this.history = initialHistory.slice(-40);
    }

    async propose(preferences: string, request: string): Promise<Proposal> {
        this.dismiss();
        const generation = this.generation;
        const proposal = await this.planRequest(preferences, request, [...this.history]);
        if (generation !== this.generation) throw new Error('Frontend: Conversation was cleared.');
        if (!proposal.comment || !Array.isArray(proposal.actions)) throw new Error('AI response processing: Invalid proposal.');
        this.pendingActions = proposal.actions.length ? proposal.actions : null;
        this.add({ role: 'USER', content: request });
        this.add({ role: 'ASSISTANT', content: proposal.comment, actions: proposal.actions });
        return proposal;
    }

    dismiss(): void {
        if (this.pendingActions) {
            this.add({ role: 'ASSISTANT', content: 'The proposed changes were dismissed.' });
        }
        this.pendingActions = null;
    }

    clearHistory(): void {
        this.generation++;
        this.pendingActions = null;
        this.history = [];
    }

    async confirm(actions: CalendarAction[]): Promise<ExecutionResult> {
        if (this.pendingActions !== actions) throw new Error('Frontend: This proposal is no longer active.');
        const result = await this.executeRequest(actions);
        this.pendingActions = null;
        this.add({ role: 'ASSISTANT', content: executionMessage(result) });
        return result;
    }

    private add(message: ChatMessage): void {
        this.history.push(message);
        if (this.history.length > 40) this.history = this.history.slice(-40);
    }
}

function executionMessage(result: ExecutionResult): string {
    if (result.failed === 0) {
        return result.executed === 1 ? 'Change applied.' : 'Changes applied.';
    }
    if (result.executed === 0) {
        return 'No changes were applied. Please try again.';
    }

    const applied = `${result.executed} ${result.executed === 1 ? 'change' : 'changes'} applied.`;
    const failed = `${result.failed} ${result.failed === 1 ? 'change could' : 'changes could'} not be applied.`;
    return `${applied} ${failed}`;
}
