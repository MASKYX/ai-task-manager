import { trimHistory } from "./botSession.ts";
import type { CalendarAction, ChatMessage } from "./types.ts";

export type StorageScope =
    | { kind: "demo" }
    | { kind: "cognito"; userKey: string | null };

type ChatEnvelope = {
    savedAt: number;
    messages: ChatMessage[];
};

type PreferencesEnvelope = {
    savedAt: number;
    text: string;
};

const STORAGE_PREFIX = "taskai.v3";
const CHAT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const PREFERENCES_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function storageFor(kind: StorageScope["kind"]): Storage | null {
    try {
        return kind === "demo" ? window.sessionStorage : window.localStorage;
    } catch {
        return null;
    }
}

function baseKey(scope: StorageScope): string | null {
    if (scope.kind === "demo") return `${STORAGE_PREFIX}.demo`;
    if (!scope.userKey) return null;
    return `${STORAGE_PREFIX}.${scope.userKey}`;
}

function readJson<T>(storage: Storage | null, key: string): T | null {
    if (!storage) return null;
    try {
        const raw = storage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : null;
    } catch {
        return null;
    }
}

function writeJson(storage: Storage | null, key: string, value: unknown): boolean {
    if (!storage) return false;
    try {
        storage.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false;
    }
}

function removeStoredItem(storage: Storage, key: string): void {
    try {
        storage.removeItem(key);
    } catch {
        // Reading or clearing storage can be blocked independently by the browser.
    }
}

function isAction(value: unknown): value is CalendarAction {
    if (!value || typeof value !== "object") return false;
    const action = value as Record<string, unknown>;
    return action.type === "CREATE_EVENT" || action.type === "UPDATE_EVENT" || action.type === "DELETE_EVENT";
}

function isMessage(value: unknown): value is ChatMessage {
    if (!value || typeof value !== "object") return false;
    const message = value as Record<string, unknown>;
    if (message.role !== "USER" && message.role !== "ASSISTANT") return false;
    if (typeof message.content !== "string" || !message.content.trim()) return false;
    if (message.actions !== undefined && !Array.isArray(message.actions)) return false;

    return !Array.isArray(message.actions) || message.actions.every(isAction);
}

export function loadChatHistory(scope: StorageScope): ChatMessage[] {
    const storage = storageFor(scope.kind);
    const base = baseKey(scope);
    if (!storage || !base) return [];

    const key = `${base}.chat`;
    const envelope = readJson<ChatEnvelope>(storage, key);
    if (!envelope || !Array.isArray(envelope.messages)) {
        removeStoredItem(storage, key);
        return [];
    }
    if (typeof envelope.savedAt !== "number" || Date.now() - envelope.savedAt > CHAT_TTL_MS) {
        removeStoredItem(storage, key);
        return [];
    }

    return trimHistory(envelope.messages.filter(isMessage));
}

export function saveChatHistory(scope: StorageScope, messages: ChatMessage[]): boolean {
    const storage = storageFor(scope.kind);
    const base = baseKey(scope);
    if (!storage || !base) return false;

    const trimmed = trimHistory(messages);
    return writeJson(storage, `${base}.chat`, {
        savedAt: Date.now(),
        messages: trimmed,
    } satisfies ChatEnvelope);
}

export function loadPreferences(scope: StorageScope): string {
    const storage = storageFor(scope.kind);
    const base = baseKey(scope);
    if (!storage || !base) return "";

    const key = `${base}.preferences`;
    const envelope = readJson<PreferencesEnvelope>(storage, key);
    if (!envelope || typeof envelope.text !== "string" || typeof envelope.savedAt !== "number") {
        removeStoredItem(storage, key);
        return "";
    }
    if (Date.now() - envelope.savedAt > PREFERENCES_TTL_MS) {
        removeStoredItem(storage, key);
        return "";
    }
    return envelope.text;
}

export function savePreferences(scope: StorageScope, text: string): boolean {
    const storage = storageFor(scope.kind);
    const base = baseKey(scope);
    if (!storage || !base) return false;

    return writeJson(storage, `${base}.preferences`, {
        savedAt: Date.now(),
        text,
    } satisfies PreferencesEnvelope);
}

export function clearStoredData(scope: StorageScope): void {
    const storage = storageFor(scope.kind);
    const base = baseKey(scope);
    if (!storage || !base) return;

    try {
        storage.removeItem(`${base}.chat`);
        storage.removeItem(`${base}.preferences`);
    } catch {
        // Storage can be disabled; there is nothing else to clean up.
    }
}

export function clearLegacyChatData(userKey: string | null): void {
    try {
        if (userKey) {
            window.localStorage.removeItem(`taskai.bot.history.${userKey}`);
            window.localStorage.removeItem(`taskai.bot.preferences.${userKey}`);
            return;
        }

        for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
            const key = window.localStorage.key(index);
            if (key?.startsWith("taskai.bot.")) window.localStorage.removeItem(key);
        }
    } catch {
        // Storage can be disabled; there is nothing else to clean up.
    }
}
