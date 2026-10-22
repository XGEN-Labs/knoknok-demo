import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi, chatHistory } from '../api.mjs';
import { initialState, reduce, serializeState, hydrateState } from '../model.mjs';

const reply = (data, status = 200) => new Response(JSON.stringify(data), { status });
test('cookie login and owner-checked chat send no agent credentials or profile', async () => {
  const calls = [];
  const api = createApi({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/login')) return reply({ user: { id: 7, username: 'knoknok01' } });
    return reply({ text: '来自 Agent', source: 'model', provider: 'knok-agent' });
  } });
  const user = await api.login('knoknok01', 'test-only');
  const messages = [{ role: 'user', content: '你好' }];
  const result = await api.chat(messages, user.id, new AbortController().signal);
  assert.equal(result.provider, 'knok-agent');
  assert.equal(calls[0].url, '/api/auth/login');
  assert.equal(calls[1].url, '/api/web/chat');
  assert.equal(calls[1].options.credentials, 'same-origin');
  assert.deepEqual(calls[1].options.headers, { 'Content-Type': 'application/json', 'X-Knok-User-Id': '7' });
  assert.deepEqual(JSON.parse(calls[1].options.body), { messages });
});

test('only 401 restores signed-out session; backend errors stay visible', async () => {
  const unauthorized = createApi({ fetchImpl: async () => reply({ error: 'unauthorized' }, 401) });
  assert.equal(await unauthorized.me(), null);
  const offline = createApi({ fetchImpl: async () => new Response('<html>Pages</html>') });
  await assert.rejects(offline.me(), /服務尚未連接/);
  const down = createApi({ fetchImpl: async () => { throw new TypeError('network'); } });
  await assert.rejects(down.me(), /連線未完成/);
});

test('denials propagate without browser retries or fake fallback', async () => {
  let count = 0;
  const api = createApi({ fetchImpl: async () => {
    count++;
    return reply({ error: '身份拒绝', code: 'KNOK_AUTHZ_DENIED' }, 403);
  } });
  await assert.rejects(api.chat([{ role: 'user', content: 'hi' }], 1), e => e.status === 403 && e.code === 'KNOK_AUTHZ_DENIED');
  assert.equal(count, 1);
});

test('empty, malformed and different-provider replies are rejected', async () => {
  for (const data of [{ text: '', source: 'model', provider: 'knok-agent' }, { text: 'fake' }]) {
    await assert.rejects(createApi({ fetchImpl: async () => reply(data) }).chat([], 1), /回覆未完成/);
  }
  const data = { text: 'fallback', source: 'model', provider: 'gemini', fallback: true };
  await assert.rejects(createApi({ fetchImpl: async () => reply(data) }).chat([], 1), /回覆未完成/);
});

test('cancelled request propagates cancellation without fallback', async () => {
  const controller = new AbortController();
  controller.abort();
  const api = createApi({ fetchImpl: async (_url, { signal }) => { signal.throwIfAborted(); } });
  await assert.rejects(api.chat([], 1, controller.signal), { name: 'AbortError' });
});

test('live chat never inserts local replies; failed retry reuses bubble; late duplicate ignored', () => {
  let state = reduce(initialState(), { type: 'DEMO_LOGIN', provider: 'account' });
  const startCount = state.private.a.companionMessages.length;
  state = reduce(state, { type: 'COMPANION_REQUEST', id: 'req-1', text: '你好' });
  assert.equal(state.private.a.companionMessages.length, startCount + 1);
  assert.equal(state.private.a.companionMessages.at(-1).status, 'pending');
  state = reduce(state, { type: 'COMPANION_REJECT', id: 'req-1', error: '连接失败' });
  assert.equal(state.private.a.companionMessages.length, startCount + 1);
  state = reduce(state, { type: 'COMPANION_RESOLVE', id: 'req-1', text: '迟到' });
  assert.equal(state.private.a.companionMessages.length, startCount + 1);
  state = reduce(state, { type: 'COMPANION_REQUEST', id: 'req-1', text: '你好' });
  state = reduce(state, { type: 'COMPANION_RESOLVE', id: 'req-1', text: '真实回复', provider: 'knok-agent' });
  state = reduce(state, { type: 'COMPANION_RESOLVE', id: 'req-1', text: '重复' });
  assert.equal(state.private.a.companionMessages.length, startCount + 2);
  const restored = hydrateState(serializeState(state));
  assert.equal(restored.private.a.companionMessages.at(-1).text, '真实回复');
  assert.equal(restored.private.a.companionMessages.at(-1).provider, 'knok-agent');
  assert.deepEqual(chatHistory(restored.private.a.companionMessages, ' 下一条 '), [
    { role: 'user', content: '你好' }, { role: 'assistant', content: '真实回复' }, { role: 'user', content: '下一条' },
  ]);
});

test('fallback history excludes demo/failed/pending messages and bounds context', () => {
  const messages = Array.from({ length: 30 }, (_, i) => ({ role: 'assistant', text: String(i), source: 'model', status: 'complete' }));
  messages.push({ role: 'user', text: 'failed', source: 'model', status: 'failed' },
    { role: 'user', text: 'pending', source: 'model', status: 'pending' },
    { role: 'assistant', text: 'demo' });
  const history = chatHistory(messages, 'new');
  assert.equal(history.length, 12);
  assert.equal(history[0].content, '19');
  assert.equal(history.at(-1).content, 'new');
});

test('retrying an older failure preserves chronological context after later turns', () => {
  let state = reduce(initialState(), { type: 'DEMO_LOGIN', provider: 'account' });
  for (const action of [
    { type: 'COMPANION_REQUEST', id: 'old', text: 'first' },
    { type: 'COMPANION_REJECT', id: 'old', error: 'offline' },
    { type: 'COMPANION_REQUEST', id: 'new', text: 'second' },
    { type: 'COMPANION_RESOLVE', id: 'new', text: 'second reply' },
    { type: 'COMPANION_REQUEST', id: 'old', text: 'first' },
    { type: 'COMPANION_RESOLVE', id: 'old', text: 'first reply' },
  ]) state = reduce(state, action);
  assert.deepEqual(chatHistory(state.private.a.companionMessages, 'next').map(m => m.content),
    ['second', 'second reply', 'first', 'first reply', 'next']);
});
