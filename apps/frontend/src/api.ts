import { apiUrl } from "./config.ts";
import type {
    AiQuota,
    CalendarAction,
    CalendarEvent,
    CalendarProvider,
    ChatMessage,
    EventInput,
    ExecutionResult,
    Proposal,
} from "./types.ts";

type AuthHooks = {
    getAccessToken: () => Promise<string | null>;
    renewAccessToken: () => Promise<boolean>;
    onUnauthorized: () => void;
};

type ApiErrorBody = {
    error?: unknown;
    code?: unknown;
};

export class ApiError extends Error {
    readonly status: number;
    readonly code?: string;

    constructor(status: number, message: string, code?: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === "AbortError";
}

export function errorMessage(error: unknown): string {
    if (error instanceof ApiError) return error.message;
    if (error instanceof Error && error.message) return error.message;
    return "Something went wrong. Please try again.";
}

function fallbackMessage(status: number): string {
    if (status === 400) return "The request was not valid. Please check the details and try again.";
    if (status === 403) return "You do not have access to that calendar.";
    if (status === 404) return "That event no longer exists.";
    if (status === 429) return "Too many requests. Please try again shortly.";
    if (status >= 500) return "The server had a problem. Please try again.";
    return `The request failed (${status}).`;
}

async function parseError(response: Response): Promise<ApiError> {
    let body: ApiErrorBody = {};
    try {
        body = (await response.json()) as ApiErrorBody;
    } catch {
        // Non-JSON errors use the status fallback below.
    }

    const message = typeof body.error === "string" && body.error.trim()
        ? body.error
        : fallbackMessage(response.status);
    const code = typeof body.code === "string" ? body.code : undefined;
    return new ApiError(response.status, message, code);
}

async function demoRequest(path: string, method: "GET" | "POST"): Promise<Response> {
    try {
        return await fetch(apiUrl(path), {
            method,
            credentials: "include",
            cache: "no-store",
        });
    } catch {
        throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
    }
}

export async function getDemoSession(): Promise<boolean> {
    const response = await demoRequest("/api/demo/session", "GET");
    if (response.ok) return true;
    if (response.status === 401 || response.status === 403) return false;
    throw await parseError(response);
}

export async function startDemoSession(): Promise<void> {
    const response = await demoRequest("/api/demo/start", "POST");
    if (!response.ok) throw await parseError(response);
}

export async function endDemoSession(): Promise<void> {
    const response = await demoRequest("/api/demo/end", "POST");
    if (response.status >= 500) throw await parseError(response);
}

export class ApiClient {
    private readonly auth: AuthHooks;

    constructor(auth: AuthHooks) {
        this.auth = auth;
    }

    getProvider(signal?: AbortSignal): Promise<CalendarProvider> {
        return this.request("/api/calendar/provider", { signal });
    }

    setProvider(provider: CalendarProvider): Promise<CalendarProvider> {
        return this.request(`/api/calendar/provider?provider=${encodeURIComponent(provider)}`, {
            method: "PUT",
        });
    }

    listEvents(start: Date, end: Date, signal?: AbortSignal): Promise<CalendarEvent[]> {
        const params = new URLSearchParams({
            timeMin: start.toISOString(),
            timeMax: end.toISOString(),
        });
        return this.request(`/api/calendar/events?${params.toString()}`, { signal });
    }

    createEvent(input: EventInput): Promise<CalendarEvent> {
        return this.request("/api/calendar/events", {
            method: "POST",
            body: JSON.stringify(input),
        });
    }

    updateEvent(id: string, input: EventInput): Promise<CalendarEvent> {
        return this.request(`/api/calendar/events/${encodeURIComponent(id)}`, {
            method: "PUT",
            body: JSON.stringify(input),
        });
    }

    deleteEvent(id: string): Promise<void> {
        return this.request(`/api/calendar/events/${encodeURIComponent(id)}`, {
            method: "DELETE",
        });
    }

    getQuota(signal?: AbortSignal): Promise<AiQuota> {
        return this.request("/api/agent/quota", { signal });
    }

    plan(
        preferences: string,
        request: string,
        history: ChatMessage[],
        signal?: AbortSignal,
    ): Promise<Proposal> {
        return this.request("/api/agent/plan", {
            method: "POST",
            body: JSON.stringify({ preferences, request, history }),
            signal,
        });
    }

    execute(actions: CalendarAction[], signal?: AbortSignal): Promise<ExecutionResult> {
        return this.request("/api/agent/execute", {
            method: "POST",
            body: JSON.stringify({ actions }),
            signal,
        });
    }

    private async request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
        const headers = new Headers(init.headers);
        headers.set("Accept", "application/json");
        if (init.body !== undefined) headers.set("Content-Type", "application/json");

        let token: string | null = null;
        try {
            token = await this.auth.getAccessToken();
        } catch {
            token = null;
        }
        if (token) headers.set("Authorization", `Bearer ${token}`);

        let response: Response;
        try {
            response = await fetch(apiUrl(path), {
                ...init,
                headers,
                credentials: "include",
                cache: "no-store",
            });
        } catch (error) {
            if (isAbortError(error)) throw error;
            throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
        }

        if (response.status === 401) {
            if (retry && await this.auth.renewAccessToken()) {
                return this.request<T>(path, init, false);
            }
            this.auth.onUnauthorized();
            throw new ApiError(401, "Your session expired. Please sign in again.");
        }

        if (!response.ok) throw await parseError(response);
        if (response.status === 204) return undefined as T;

        const contentType = response.headers.get("Content-Type") ?? "";
        if (!contentType.toLowerCase().includes("application/json")) return undefined as T;

        const text = await response.text();
        if (!text) return undefined as T;

        try {
            return JSON.parse(text) as T;
        } catch {
            throw new ApiError(response.status, "The server returned an unexpected response.");
        }
    }
}
