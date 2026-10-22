import test from "node:test";
import assert from "node:assert/strict";
import { loadChatHistory, loadPreferences, saveChatHistory, savePreferences } from "./storage.ts";

test("blocked storage does not prevent the app from loading", (t) => {
    const previous = globalThis.window;
    t.after(() => { globalThis.window = previous; });
    const blocked = {
        getItem() { throw new Error("Storage blocked"); },
        setItem() { throw new Error("Storage blocked"); },
        removeItem() { throw new Error("Storage blocked"); },
    };
    globalThis.window = { localStorage: blocked, sessionStorage: blocked };

    for (const scope of [{ kind: "demo" }, { kind: "cognito", userKey: "user-1" }]) {
        assert.deepEqual(loadChatHistory(scope), []);
        assert.equal(loadPreferences(scope), "");
        assert.equal(saveChatHistory(scope, []), false);
        assert.equal(savePreferences(scope, "Prefer mornings"), false);
    }
});

test("expired data is ignored even if the browser refuses to remove it", (t) => {
    const previous = globalThis.window;
    t.after(() => { globalThis.window = previous; });
    globalThis.window = {
        localStorage: {
            getItem: () => JSON.stringify({ savedAt: 0, messages: [], text: "Old preferences" }),
            removeItem() { throw new Error("Storage blocked"); },
        },
    };
    const scope = { kind: "cognito", userKey: "user-1" };
    assert.deepEqual(loadChatHistory(scope), []);
    assert.equal(loadPreferences(scope), "");
});
