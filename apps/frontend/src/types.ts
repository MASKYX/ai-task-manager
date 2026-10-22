export type CalendarProvider = "LOCAL" | "GOOGLE";

export type CalendarEvent = {
    id: string;
    summary?: string | null;
    description?: string | null;
    startDateTime: string;
    endDateTime: string;
    allDay: boolean;
};

export type EventInput = {
    summary: string;
    description: string;
    startDateTime: string;
    endDateTime: string;
    allDay: boolean;
};

export type CalendarActionType = "CREATE_EVENT" | "UPDATE_EVENT" | "DELETE_EVENT";

export type CalendarAction = {
    type: CalendarActionType;
    eventId?: string | null;
    summary?: string | null;
    description?: string | null;
    startDateTime?: string | null;
    endDateTime?: string | null;
    allDay?: boolean | null;
};

export type ChatRole = "USER" | "ASSISTANT";

export type ChatMessage = {
    role: ChatRole;
    content: string;
    actions?: CalendarAction[];
};

export type AiQuota = {
    remaining: number;
    limit: number;
};

export type Proposal = {
    comment: string;
    actions: CalendarAction[];
    quota?: AiQuota;
};

export type ActionResult = {
    index: number;
    success: boolean;
    message: string;
};

export type ExecutionResult = {
    message: string;
    executed: number;
    failed: number;
    results: ActionResult[];
};

export const HISTORY_MESSAGE_LIMIT = 40;
export const HISTORY_CHARACTER_LIMIT = 16_000;
export const REQUEST_CHARACTER_LIMIT = 4_000;
export const PREFERENCES_CHARACTER_LIMIT = 2_000;
