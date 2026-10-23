// Same-origin, cookie-authenticated access to the iOS backend.
// Agent credentials, room bindings and provider fallback never live here.
export class ApiError extends Error {
  constructor(message, status = 0, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export function createApi({ fetchImpl = globalThis.fetch } = {}) {
  async function request(path, { body, signal, owner } = {}) {
    let response;
    try {
      response = await fetchImpl(`/api${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        credentials: 'same-origin',
        headers: {
          ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(owner === undefined ? {} : { 'X-Knok-User-Id': String(owner) }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        // Allow three 15s Agent attempts plus the shared route's 15s fallback.
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(70000)]) : AbortSignal.timeout(15000),
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ApiError('連線未完成，請稍後再試。');
    }
    let data;
    try { data = await response.json(); }
    catch { throw new ApiError('服務尚未連接，請確認網站後端已啟動。', response.status); }
    if (!response.ok) throw new ApiError(
      typeof data?.error === 'string' ? data.error : '服務暫時無法完成請求。',
      response.status, data?.code || '',
    );
    return data;
  }
  function userFrom(data) {
    if (!data?.user || !['string', 'number'].includes(typeof data.user.id) || !data.user.username) {
      throw new ApiError('登入回應無效，請重試。');
    }
    return data.user;
  }
  return {
    async me() {
      try { return userFrom(await request('/auth/me')); }
      catch (error) { if (error.status === 401) return null; throw error; }
    },
    async login(username, password) {
      return userFrom(await request('/auth/login', { body: { username, password } }));
    },
    logout: () => request('/auth/logout', { body: {} }),
    async chat(messages, owner, signal) {
      const data = await request('/web/chat', { body: { messages }, owner, signal });
      if (typeof data?.text !== 'string' || !data.text.trim() ||
          !['knok-agent', 'gemini'].includes(data.provider) || data.source !== 'model') {
        throw new ApiError('回覆未完成，請稍後再試。');
      }
      return data;
    },
  };
}

export function chatHistory(messages, text) {
  // Exclude local scenario dialogue, failed sends and pending turns from fallback context.
  return [
    ...messages.filter(m => m.source === 'model' && m.status === 'complete')
      .slice(-11).map(m => ({ role: m.role, content: m.text })),
    { role: 'user', content: text.trim() },
  ];
}
