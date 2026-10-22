import test from "node:test";
import assert from "node:assert/strict";
import { BotSession, ConversationClearedError, executionSummary, trimHistory } from "./botSession.ts";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

function assistantMessage(content) {
    return { role: "ASSISTANT", content, actions: [] };
}

test("a request appears in history before the assistant answers", async () => {
    const pending = deferred();
    let receivedHistory;
    const session = new BotSession(async (_preferences, _request, history) => {
        receivedHistory = history;
        return pending.promise;
    }, async () => {
        throw new Error("Unexpected execution");
    });

    const request = session.propose("Prefer mornings", "Plan my week");
    assert.equal(session.history.length, 1);
    assert.equal(session.history[0].content, "Plan my week");
    assert.deepEqual(receivedHistory, []);

    pending.resolve({ comment: "Here is a plan.", actions: [] });
    await request;
    assert.deepEqual(session.history.map((message) => message.role), ["USER", "ASSISTANT"]);
});

test("a failed plan rolls the user message back", async () => {
    const session = new BotSession(async () => {
        throw new Error("Network down");
    }, async () => {
        throw new Error("Unexpected execution");
    });

    await assert.rejects(session.propose("", "Plan my week"), /Network down/);
    assert.equal(session.history.length, 0);
});

test("a proposal must be confirmed before execution", async () => {
    let executions = 0;
    const actions = [{ type: "CREATE_EVENT", summary: "Gym" }];
    const session = new BotSession(
        async () => ({ comment: "Confirm this change.", actions }),
        async (received) => {
            executions += 1;
            assert.equal(received, actions);
            return {
                message: "Applied.",
                executed: 1,
                failed: 0,
                results: [{ index: 0, success: true, message: "Applied." }],
            };
        },
    );

    await session.propose("", "Schedule gym");
    assert.equal(executions, 0);
    assert.equal(session.pendingActions, actions);

    const result = await session.confirm(actions);
    assert.equal(result.executed, 1);
    assert.equal(executions, 1);
    assert.equal(session.pendingActions, null);
    assert.equal(session.history.at(-1)?.content, "Applied 1 change.");
});

test("partial failures keep only the failed actions for retry", async () => {
    const actions = [
        { type: "CREATE_EVENT", summary: "Gym" },
        { type: "CREATE_EVENT", summary: "Study" },
    ];
    const session = new BotSession(async () => ({ comment: "Confirm.", actions }), async () => ({
        message: "Some changes failed.",
        executed: 1,
        failed: 1,
        results: [
            { index: 0, success: true, message: "Applied." },
            { index: 1, success: false, message: "Provider error." },
        ],
    }));

    await session.propose("", "Plan");
    await session.confirm(actions);

    assert.deepEqual(session.pendingActions, [actions[1]]);
    assert.match(session.history.at(-1)?.content ?? "", /Applied 1 of 2 changes/);
    assert.match(session.history.at(-1)?.content ?? "", /Study: Provider error/);
});

test("clearing during a plan cancels the stale response", async () => {
    const pending = deferred();
    const session = new BotSession(async () => pending.promise, async () => {
        throw new Error("Unexpected execution");
    });

    const request = session.propose("", "Plan");
    session.clearHistory();
    pending.resolve({ comment: "Late response", actions: [] });

    await assert.rejects(request, ConversationClearedError);
    assert.equal(session.history.length, 0);
});

test("clearing during execution does not write into the cleared conversation", async () => {
    const pending = deferred();
    const actions = [{ type: "CREATE_EVENT", summary: "Gym" }];
    const session = new BotSession(async () => ({ comment: "Confirm.", actions }), async () => pending.promise);

    await session.propose("", "Gym");
    const confirmation = session.confirm(actions);
    session.clearHistory();
    pending.resolve({
        message: "Applied.",
        executed: 1,
        failed: 0,
        results: [{ index: 0, success: true, message: "Applied." }],
    });

    await assert.rejects(confirmation, ConversationClearedError);
    assert.equal(session.history.length, 0);
});

test("dismissing a proposal records the decision", async () => {
    const actions = [{ type: "CREATE_EVENT", summary: "Gym" }];
    const session = new BotSession(async () => ({ comment: "Confirm.", actions }), async () => {
        throw new Error("Unexpected execution");
    });

    await session.propose("", "Gym");
    assert.equal(session.dismiss(), true);
    assert.equal(session.pendingActions, null);
    assert.equal(session.history.at(-1)?.content, "The proposed changes were dismissed.");
    assert.equal(session.dismiss(), false);
});

test("restored history is sent with the next request", async () => {
    const saved = [
        { role: "USER", content: "Earlier request" },
        assistantMessage("Earlier reply"),
    ];
    let received;
    const session = new BotSession(async (_preferences, _request, history) => {
        received = history;
        return { comment: "Follow-up received.", actions: [] };
    }, async () => {
        throw new Error("Unexpected execution");
    }, saved);

    await session.propose("", "Follow up");
    assert.deepEqual(received, saved);
    assert.equal(session.history.length, 4);
});

test("the quota returned with a plan is preserved", async () => {
    const session = new BotSession(async () => ({
        comment: "Done.",
        actions: [],
        quota: { remaining: 19, limit: 20 },
    }), async () => {
        throw new Error("Unexpected execution");
    });

    const proposal = await session.propose("", "Review today");
    assert.deepEqual(proposal.quota, { remaining: 19, limit: 20 });
});

test("history is trimmed by message count and total characters", () => {
    const many = Array.from({ length: 50 }, (_, index) => assistantMessage(`message ${index}`));
    const trimmed = trimHistory(many);
    assert.equal(trimmed.length, 40);
    assert.equal(trimmed.at(-1).content, "message 49");

    const longMessages = Array.from({ length: 5 }, () => assistantMessage("x".repeat(4_000)));
    const trimmedLong = trimHistory(longMessages);
    assert.equal(trimmedLong.length, 4);
    assert.equal(trimmedLong.reduce((total, message) => total + message.content.length, 0), 16_000);
});

test("execution summaries include failed action details", () => {
    const summary = executionSummary({
        message: "Some failed.",
        executed: 1,
        failed: 1,
        results: [
            { index: 0, success: true, message: "Applied." },
            { index: 1, success: false, message: "Provider error." },
        ],
    }, [
        { type: "CREATE_EVENT", summary: "Gym" },
        { type: "UPDATE_EVENT", summary: "Review" },
    ]);

    assert.match(summary, /Applied 1 of 2 changes/);
    assert.match(summary, /Review: Provider error/);
});
