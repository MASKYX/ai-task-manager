import test from "node:test";
import assert from "node:assert/strict";
import { setImmediate } from "node:timers/promises";
import { EventDialog } from "./ui/eventDialog.ts";
import { BotPanel } from "./ui/botPanel.ts";

// Minimal DOM for exercising form events without adding a browser dependency.
class Element extends EventTarget {
    value = "";
    checked = false;
    disabled = false;
    hidden = false;
    open = false;
    children = [];
    style = {};
    scrollTop = 0;
    scrollHeight = 0;
    clientHeight = 0;
    classList = { add() {}, remove() {}, toggle() {} };
    setAttribute() {}
    focus() {}
    append(...children) { this.children.push(...children); }
    appendChild(child) { this.append(child); return child; }
    replaceChildren(...children) { this.children = children; }
    showModal() { this.open = true; }
    close() { this.open = false; }
}

function setupDom(t) {
    const previousDocument = globalThis.document;
    const previousWindow = globalThis.window;
    t.after(() => {
        globalThis.document = previousDocument;
        globalThis.window = previousWindow;
    });
    const elements = new Map();
    const query = (selector) => {
        if (!elements.has(selector)) elements.set(selector, new Element());
        return elements.get(selector);
    };
    globalThis.document = {
        querySelector: query,
        createElement: () => new Element(),
        createElementNS: () => new Element(),
        getElementById: () => null,
    };
    globalThis.window = { setTimeout: () => 0, clearTimeout() {} };
    return query;
}

test("editing a timed event preserves midnight start and end times", (t) => {
    const query = setupDom(t);
    const dialog = new EventDialog({ onSave: async () => {}, onDelete: async () => {} });
    dialog.openEdit({
        id: "overnight",
        summary: "Overnight shift",
        allDay: false,
        startDateTime: new Date(2026, 9, 21, 0).toISOString(),
        endDateTime: new Date(2026, 9, 22, 0).toISOString(),
    });
    assert.equal(query("#event-start-time").value, "00:00");
    assert.equal(query("#event-end-time").value, "00:00");
    assert.equal(query("#event-end-date").value, "2026-10-22");
});

test("a cleared chat request cannot enable sending while the next request is pending", async (t) => {
    const query = setupDom(t);
    const requests = [];
    const panel = new BotPanel({
        scope: null,
        api: {
            getQuota: async () => ({ remaining: 20, limit: 20 }),
            plan: () => new Promise((resolve, reject) => requests.push({ resolve, reject })),
        },
        onEventsChanged: async () => {},
    });
    panel.start();
    await setImmediate();
    query("#chat-input").value = "First request";
    query("#chat-form").dispatchEvent(new Event("submit"));
    query("#chat-clear").dispatchEvent(new Event("click"));
    query("#chat-input").value = "Second request";
    query("#chat-form").dispatchEvent(new Event("submit"));

    requests[0].reject(new DOMException("Aborted", "AbortError"));
    await setImmediate();
    assert.equal(panel.isWorking, true);
    query("#chat-input").value = "Third request";
    query("#chat-input").dispatchEvent(new Event("input"));
    assert.equal(query("#chat-send").disabled, true);

    requests[1].resolve({ comment: "Second reply", actions: [] });
    await setImmediate();
    assert.equal(panel.isWorking, false);
    assert.equal(query("#chat-send").disabled, false);
});
