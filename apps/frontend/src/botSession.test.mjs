import test from 'node:test';
import assert from 'node:assert/strict';
import { BotSession, quotaView } from './botSession.ts';

test('quota view displays remaining requests and passive exhaustion state', () => {
    assert.deepEqual(quotaView({ remaining: 17, limit: 20 }), {
        label: '17 / 20 requests', exhausted: false
    });
    assert.deepEqual(quotaView({ remaining: 0, limit: 20 }), {
        label: '0 / 20 requests', exhausted: true
    });
});

test('proposal requires explicit confirmation before execution', async () => {
    let executions = 0;
    const actions = [{ type: 'CREATE_EVENT', summary: 'Gym' }];
    const session = new BotSession(async () => ({ comment: 'Please confirm.', actions }), async received => {
        executions++;
        assert.equal(received, actions);
        return { message: 'Applied.', executed: 1, failed: 0,
            results: [{ index: 0, success: true, message: 'Applied.' }] };
    });
    const proposal = await session.propose('', 'Schedule gym');
    assert.equal(proposal.comment, 'Please confirm.');
    assert.equal(executions, 0);
    assert.equal((await session.confirm(actions)).executed, 1);
    assert.equal(executions, 1);
    assert.match(session.history.at(-1).content, /Applied: Gym/);
});

test('history is passed to the next request and cleared explicitly', async () => {
    const seen = [];
    const session = new BotSession(async (_preferences, _request, history) => {
        seen.push(history);
        return { comment: 'No changes needed.', actions: [] };
    }, async () => { throw new Error('Unexpected execution'); });
    await session.propose('', 'Review my day');
    await session.propose('', 'What about tomorrow?');
    assert.equal(seen[0].length, 0);
    assert.deepEqual(seen[1].map(item => item.role), ['USER', 'ASSISTANT']);
    session.clearHistory();
    await session.propose('', 'Start over');
    assert.equal(seen[2].length, 0);
});

test('updated quota is returned with a completed prompt', async () => {
    const session = new BotSession(async () => ({
        comment: 'Done.', actions: [], quota: { remaining: 19, limit: 20 }
    }), async () => { throw new Error('Unexpected execution'); });
    const proposal = await session.propose('', 'Review today');
    assert.deepEqual(proposal.quota, { remaining: 19, limit: 20 });
});

test('restored history is available to a follow-up request', async () => {
    const saved = [{ role: 'USER', content: 'Earlier request' },
        { role: 'ASSISTANT', content: 'Earlier proposal', actions: [] }];
    let received;
    const session = new BotSession(async (_preferences, _request, history) => {
        received = history;
        return { comment: 'Follow-up received.', actions: [] };
    }, async () => { throw new Error('Unexpected execution'); }, saved);
    await session.propose('', 'Follow up');
    assert.deepEqual(received, saved);
    assert.equal(session.history.length, 4);
});

test('partial execution result is kept in the conversation', async () => {
    const actions = [{ type: 'CREATE_EVENT', summary: 'Gym' }, { type: 'CREATE_EVENT', summary: 'Study' }];
    const session = new BotSession(async () => ({ comment: 'Confirm.', actions }), async () => ({
        message: 'Some changes failed.', executed: 1, failed: 1,
        results: [{ index: 0, success: true, message: 'Applied.' },
            { index: 1, success: false, message: 'Provider error.' }]
    }));
    await session.propose('', 'Plan');
    const result = await session.confirm(actions);
    assert.equal(result.failed, 1);
    assert.match(session.history.at(-1).content, /Failed: Study/);
});

test('dismissal prevents execution and clear cancels in-flight history', async () => {
    const actions = [{ type: 'CREATE_EVENT', summary: 'Gym' }];
    let finish;
    const session = new BotSession(async () => new Promise(resolve => { finish = resolve; }), async () => {
        throw new Error('Unexpected execution');
    });
    const request = session.propose('', 'Gym');
    session.clearHistory();
    finish({ comment: 'Confirm.', actions });
    await assert.rejects(request, /Conversation was cleared/);
    assert.equal(session.history.length, 0);
});

test('network execution failure leaves the proposal available', async () => {
    const actions = [{ type: 'CREATE_EVENT', summary: 'Gym' }];
    const session = new BotSession(async () => ({ comment: 'Confirm.', actions }), async () => {
        throw new Error('calendar provider: unavailable');
    });
    await session.propose('', 'Gym');
    await assert.rejects(session.confirm(actions), /calendar provider: unavailable/);
    assert.equal(session.pendingActions, actions);
    session.dismiss();
    assert.equal(session.pendingActions, null);
});
