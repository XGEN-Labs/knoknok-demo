// Local demo only. No credentials, network requests or real messages are stored/sent.
import { METAL_VOICES, landingComplete, validMetalVoice } from './landing.mjs';
export const STORAGE_KEY = 'knokknok-prototype-v1';
const DAY = 24 * 60 * 60 * 1000;
const copy = value => JSON.parse(JSON.stringify(value));
const clean = value => typeof value === 'string' ? value.trim() : '';
const active = state => state.session.activeUserId;
const nextId = (state, prefix) => `${prefix}-${state.nextId++}`;
const pairKey = (a, b) => [a, b].sort().join(':');
const pairBlocked = (state, a, b) => state.blockedPairs.includes(pairKey(a, b));
const fail = (state, message) => { state.error = message; return state; };
const newOnboarding = () => ({ basicsComplete: false, birthComplete: false, status: 'new', initializedAt: null, error: null, interaction: { version: 1, greeted: false, tone: null, response: null } });
const defaultBirth = ownerId => ({ date: ownerId === 'a' ? '1998-06-18' : '', time: '', unknownTime: true, place: '', timezone: '' });
const newCompanion = (stage = 'juvenile', grownAt = null) => ({ id: 'klin', name: 'Klin', element: 'metal', stage, grownAt: stage === 'adult' ? grownAt : null });

/** The default companion keeps its identity throughout onboarding and later visits. */
export function companionProfile(state, userId = active(state)) {
  const saved = state.private?.[userId]?.companion;
  const legacyAdult = userId === 'b' || (userId === 'a' && state.onboarding?.status === 'ready');
  const stage = ['juvenile', 'adult'].includes(saved?.stage) ? saved.stage : legacyAdult ? 'adult' : 'juvenile';
  const grownAt = Number.isFinite(saved?.grownAt) ? saved.grownAt
    : userId === 'a' && Number.isFinite(state.onboarding?.initializedAt) ? state.onboarding.initializedAt : state.now;
  return newCompanion(stage, grownAt);
}

function futureTime(now) {
  const date = new Date(now + 3 * DAY);
  date.setHours(14, 0, 0, 0);
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T14:00`;
}

function privateSpace(ownerId, now) {
  return {
    birth: defaultBirth(ownerId),
    companion: newCompanion(ownerId === 'b' ? 'adult' : 'juvenile', now),
    memory: ownerId === 'a' ? [
      { id: 'memory-initial-1', text: '最近工作有點累', source: '示範私人對話', status: 'confirmed', updatedAt: now },
      { id: 'memory-initial-2', text: '認識新朋友時，想先從文字聊天開始', source: '伙伴的待確認理解', status: 'pending', updatedAt: now },
    ] : [],
    companionMessages: [{ id: `welcome-${ownerId}`, role: 'assistant', text: '今天想聊什麼？', createdAt: now }],
    aiDraft: '', aiAdvice: '', aiError: null, publicDraft: '', pendingDemandSuggestion: false,
  };
}

export function initialState(now = Date.now()) {
  return {
    schemaVersion: 1, now, nextId: 1, error: null,
    session: { authenticated: false, activeUserId: 'a', provider: null },
    onboarding: newOnboarding(),
    users: {
      a: { id: 'a', name: 'Frank', language: '粵語', region: '香港', bio: '喜歡發掘城市裡的小展覽。', introVersion: 1, isSimulated: true, companionName: 'Klin', cardLabels: {}, cardTags: [], cardAvatar: '', shareRegion: false },
      b: { id: 'b', name: '阿朗', language: '粵語', region: '香港', bio: '喜歡攝影、展覽和慢慢聊天。', introVersion: 1, isSimulated: true, companionName: 'Klin', cardLabels: {}, cardTags: [], cardAvatar: '', shareRegion: false },
    },
    private: { a: privateSpace('a', now), b: privateSpace('b', now) },
    draft: {
      topic: '一起看展，聊聊最近喜歡的作品', language: '粵語', time: futureTime(now), mode: 'online', area: '九龍',
      expiresAt: now + 7 * DAY, intro: '想認識喜歡看展的朋友，可以先在線上聊聊。', hard: ['language', 'mode'],
    },
    demand: null, candidates: [], invitations: [], relationships: [], messages: [], reports: [], blockedPairs: [],
  };
}

export function validateBasics(profile = {}) {
  const errors = {};
  if (!clean(profile.name)) errors.name = '請填寫暱稱。';
  if (!clean(profile.language)) errors.language = '請選擇對話語言。';
  if (!clean(profile.region)) errors.region = '請填寫目前所在的地區。';
  return errors;
}

function birthParts(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return { year, month, day };
}

export function ageFromBirth(date, now = Date.now()) {
  const birth = birthParts(date);
  const today = new Date(now);
  if (!birth || !Number.isFinite(today.getTime())) return null;
  let age = today.getFullYear() - birth.year;
  if (today.getMonth() + 1 < birth.month || (today.getMonth() + 1 === birth.month && today.getDate() < birth.day)) age -= 1;
  return age;
}

export function validateBirth(birth = {}, now = Date.now()) {
  const errors = {};
  const age = ageFromBirth(birth.date, now);
  if (!clean(birth.date)) errors.date = '請填寫生日。';
  else if (age === null) errors.date = '請填寫有效的生日。';
  else if (age < 0) errors.date = '生日不能是未來的日期。';
  else if (age < 18) errors.date = '這次演示適用於年滿 18 歲的使用者。';
  else if (age > 120) errors.date = '請確認生日是否填寫正確。';
  if (!birth.unknownTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(clean(birth.time))) errors.time = '請填寫有效的出生時間，或選擇「不清楚」。';
  return errors;
}

export function validateDemand(draft = {}, now = Date.now()) {
  const errors = {};
  if (!clean(draft.topic)) errors.topic = '請填寫這次想一起做甚麼。';
  if (!clean(draft.language)) errors.language = '請選擇交流語言。';
  if (!clean(draft.time)) errors.time = '請選擇方便交流的時間。';
  else if (!Number.isFinite(Date.parse(draft.time)) || Date.parse(draft.time) <= now) errors.time = '請選擇尚未過去的時間。';
  if (!['online', 'offline'].includes(draft.mode)) errors.mode = '請選擇線上或線下交流。';
  if (draft.mode === 'offline' && !clean(draft.area)) errors.area = '線下見面需要填寫可前往的區域。';
  if (!Number.isFinite(Number(draft.expiresAt)) || Number(draft.expiresAt) <= now) errors.expiresAt = '請選擇未來的有效期限。';
  if (!clean(draft.intro)) errors.intro = '請確認要分享的自我介紹。';
  return errors;
}

function invalidateCandidates(state, demandId) {
  for (const candidate of state.candidates) if (candidate.demandId === demandId && candidate.status !== 'skipped') candidate.status = 'expired';
}

function closePending(state, demandId, status, reason) {
  for (const invitation of state.invitations) {
    if (invitation.demandId === demandId && invitation.status === 'pending') {
      invitation.status = status;
      invitation.closedAt = state.now;
      invitation.closedReason = reason;
    }
  }
  invalidateCandidates(state, demandId);
}

function expire(state) {
  if (state.demand && !['expired', 'ended'].includes(state.demand.status) && state.demand.expiresAt <= state.now) {
    state.demand.status = 'expired';
    closePending(state, state.demand.id, 'expired', '找人請求已到期');
  }
  for (const invitation of state.invitations) {
    if (invitation.status === 'pending' && invitation.expiresAt <= state.now) {
      invitation.status = 'expired'; invitation.closedAt = state.now; invitation.closedReason = '邀約已到期';
    }
  }
  return state;
}

function relationshipForAction(state, action) {
  return state.relationships.find(item => item.id === action.relationshipId && item.members.includes(active(state)));
}

function demandIsActive(state) {
  return state.demand && ['seeking', 'no_candidates'].includes(state.demand.status) && state.demand.expiresAt > state.now;
}

function conditionsFrom(draft) {
  return { topic: clean(draft.topic), language: clean(draft.language), time: draft.time, mode: draft.mode, area: draft.mode === 'offline' ? clean(draft.area) : '', hard: [...(draft.hard || [])] };
}

function memoryReply(space) {
  const remembered = space.memory.find(item => ['confirmed', 'corrected'].includes(item.status));
  return remembered ? `我記得你說過「${remembered.text}」。我們可以照你舒服的步調來。` : '謝謝你和我說這些。我會慢慢了解你，也隨時可以調整我的理解。';
}

/** Synchronous immutable reducer. Expected errors are returned in state.error. */
export function reduce(previous, action = {}) {
  if (action.type === 'RESET') return initialState(Number.isFinite(action.now) ? action.now : Date.now());
  const state = copy(previous);
  state.now = Math.max(state.now, Number.isFinite(action.now) ? action.now : Date.now());
  state.error = null;
  expire(state);
  const actorId = active(state);
  const space = state.private[actorId];

  if (action.type === 'CLEAR_ERROR' || action.type === 'ADVANCE_TIME') return state;
  if (action.type === 'DEMO_LOGIN') {
    if (action.code !== undefined && String(action.code) !== '123456') return fail(state, '示範驗證碼是 123456。');
    state.session = { authenticated: true, activeUserId: 'a', provider: ['google', 'account', 'demo'].includes(action.provider) ? action.provider : 'demo' };
    return state;
  }
  if (action.type === 'DEMO_LOGOUT') { state.session.authenticated = false; return state; }
  if (!state.session.authenticated) return fail(state, '請先進入示範帳號。');

  switch (action.type) {
    case 'GREET_COMPANION':
      if (actorId !== 'a') return fail(state, '這位伙伴已經認識你了。');
      state.onboarding.interaction.greeted = true;
      return state;
    case 'SELECT_METAL_VOICE':
      if (actorId !== 'a' || state.onboarding.status !== 'ready') return fail(state, '先讓 Klin 認識你一點點。');
      if (!validMetalVoice(action.tone)) return fail(state, '選一種更靠近你的表達。');
      state.onboarding.interaction.tone = action.tone;
      state.onboarding.interaction.response = null;
      return state;
    case 'RESPOND_TO_KLIN': {
      const voice = validMetalVoice(state.onboarding.interaction?.tone) ? METAL_VOICES[state.onboarding.interaction.tone] : null;
      if (actorId !== 'a' || state.onboarding.status !== 'ready' || !voice || !['resonates', 'different'].includes(action.response)) return fail(state, '先聽聽 Klin，再告訴我你的感覺。');
      state.onboarding.interaction.response = action.response;
      const memory = { id: 'landing-reflection', text: action.response === 'resonates' ? voice.memory : '我不希望被一種性格說法定義，請慢慢認識真實的我。', source: '初次見面時，由你親自確認', status: 'confirmed', updatedAt: state.now };
      const index = space.memory.findIndex(m => m.id === memory.id);
      if (index < 0) space.memory.push(memory); else space.memory[index] = memory;
      return state;
    }
    case 'SAVE_BASICS': {
      if (actorId !== 'a') return fail(state, '請切回 Frank 完成首次資料確認。');
      const profile = { ...state.users.a, ...(action.patch || {}) };
      const errors = validateBasics(profile);
      if (Object.keys(errors).length) return fail(state, Object.values(errors)[0]);
      for (const key of ['name', 'language', 'region']) state.users.a[key] = clean(profile[key]);
      state.onboarding.basicsComplete = true;
      state.onboarding.error = null;
      return state;
    }
    case 'SAVE_BIRTH': {
      if (actorId !== 'a') return fail(state, '請切回 Frank 完成首次資料確認。');
      const birth = { ...space.birth, ...(action.patch || {}) };
      const errors = validateBirth(birth, state.now);
      if (Object.keys(errors).length) return fail(state, Object.values(errors)[0]);
      space.birth = { date: clean(birth.date), time: birth.unknownTime ? '' : clean(birth.time), unknownTime: Boolean(birth.unknownTime), place: clean(birth.place), timezone: clean(birth.timezone) };
      state.onboarding.birthComplete = true;
      state.onboarding.error = null;
      return state;
    }
    case 'BEGIN_INITIALIZATION':
      if (actorId !== 'a') return fail(state, '這個示範身份已經有自己的伙伴。');
      if (state.onboarding.status === 'ready') return state;
      if (!state.onboarding.basicsComplete || !state.onboarding.birthComplete) return fail(state, '請先確認基礎資料與生日。');
      state.onboarding.status = 'preparing';
      state.onboarding.error = null;
      return state;
    case 'FINISH_INITIALIZATION':
      if (actorId !== 'a') return fail(state, '這個示範身份已經有自己的伙伴。');
      if (state.onboarding.status === 'ready') return state;
      if (state.onboarding.status !== 'preparing') return fail(state, '請先開始準備你的伙伴。');
      if (action.fail) {
        state.onboarding.status = 'failed';
        state.onboarding.error = '這次準備未能完成，資料已保留，可以再試一次。';
        return fail(state, state.onboarding.error);
      }
      state.onboarding.status = 'ready';
      state.onboarding.initializedAt = state.now;
      state.onboarding.error = null;
      return state;
    case 'ENTER_COMPANION_HOME':
      if (actorId === 'a' && state.onboarding.status !== 'ready') return fail(state, '請先完成資料確認，讓 Klin 準備好陪伴你。');
      if (!landingComplete(state)) return fail(state, '先和 Klin 打個招呼，告訴我你的感覺，再一起回家。');
      space.companion = companionProfile(state, actorId);
      if (space.companion.stage === 'juvenile') space.companion = newCompanion('adult', state.now);
      return state;
    case 'SWITCH_USER':
      if (typeof action.userId !== 'string' || !Object.hasOwn(state.users, action.userId) || !Object.hasOwn(state.private, action.userId)) return fail(state, '找不到這個示範身份。');
      state.session.activeUserId = action.userId;
      return state;
    case 'UPDATE_PROFILE': {
      const patch = action.patch || {};
      if (patch.name !== undefined && !clean(patch.name)) return fail(state, '請填寫暱稱。');
      for (const key of ['name', 'bio']) if (patch[key] !== undefined) state.users[actorId][key] = clean(patch[key]);
      if (patch.cardTags !== undefined || patch.cardLabels !== undefined) {
        state.users[actorId].cardTags = migrateCardTags(patch.cardTags ?? state.users[actorId].cardTags, patch.cardLabels);
        state.users[actorId].cardLabels = {};
      }
      if (patch.cardAvatar !== undefined) state.users[actorId].cardAvatar = normalizeCardAvatar(patch.cardAvatar);
      if (patch.shareRegion !== undefined) state.users[actorId].shareRegion = patch.shareRegion === true;
      state.users[actorId].introVersion += 1;
      return state;
    }
    case 'UPDATE_DRAFT': {
      if (actorId !== 'a') return fail(state, '請切回 Frank 編輯這次的示範需求。');
      const patch = action.patch || {};
      for (const key of ['topic', 'language', 'time', 'mode', 'area', 'expiresAt', 'intro', 'hard']) {
        if (patch[key] !== undefined) state.draft[key] = copy(patch[key]);
      }
      return state;
    }
    case 'SUBMIT_DEMAND': {
      if (actorId !== 'a') return fail(state, '請切回 Frank 確認這次的示範需求。');
      const errors = validateDemand(state.draft, state.now);
      if (Object.keys(errors).length) return fail(state, Object.values(errors)[0]);
      if (action.fail) return fail(state, '這次提交未成功，填寫的內容已保留，請再試一次。');
      const pending = state.demand && state.invitations.some(item => item.demandId === state.demand.id && item.status === 'pending');
      if (pending && !action.confirmReplace) return fail(state, '更改需求會撤回尚未回覆的邀約，請確認後再提交。');
      const version = (state.demand?.version || 0) + 1;
      if (state.demand) closePending(state, state.demand.id, 'withdrawn', '發起方已更新找人需求');
      state.demand = {
        id: nextId(state, 'demand'), ownerId: actorId, version, status: 'seeking',
        conditions: conditionsFrom(state.draft), introSnapshot: { name: state.users[actorId].name, intro: clean(state.draft.intro), introVersion: state.users[actorId].introVersion },
        expiresAt: Number(state.draft.expiresAt), createdAt: state.now,
      };
      return state;
    }
    case 'MATCH_FOUND': {
      if (!demandIsActive(state)) return fail(state, '找人請求已暫停或失效，請重新確認需求。');
      const ownerId = state.demand.ownerId;
      const userId = ownerId === 'a' ? 'b' : 'a';
      if (pairBlocked(state, ownerId, userId)) return fail(state, '已封鎖這段聯繫，不再推薦或接收新邀約。');
      if (state.relationships.some(item => item.status === 'active' && item.members.includes(ownerId) && item.members.includes(userId))) return fail(state, '你們已建立聯繫，可以到關係頁繼續聊天。');
      if (state.candidates.some(item => item.demandId === state.demand.id && item.userId === userId && ['available', 'invited'].includes(item.status))) return state;
      // Trying again must not bring back someone skipped during this search.
      if (state.candidates.some(item => item.demandId === state.demand.id && item.userId === userId && item.status === 'skipped')) {
        state.demand.status = 'no_candidates';
        return state;
      }
      state.demand.status = 'seeking';
      const c = state.demand.conditions;
      state.candidates.push({
        id: nextId(state, 'candidate'), userId, ownerId, demandId: state.demand.id, demandVersion: state.demand.version,
        name: state.users[userId].name, bio: state.users[userId].bio, conditions: copy(c),
        reasons: [`也想${c.topic}`, `可以使用${c.language}交流`, c.mode === 'online' ? '願意先在線上聊聊' : `可以到${c.area}見面`],
        status: 'available', isSimulated: true,
      });
      return state;
    }
    case 'MATCH_NONE':
      if (!demandIsActive(state)) return fail(state, '請重新確認需求後再尋找。');
      state.demand.status = 'no_candidates';
      for (const item of state.candidates) if (item.demandId === state.demand.id && item.status === 'available') item.status = 'expired';
      return state;
    case 'SKIP_CANDIDATE': {
      const candidate = state.candidates.find(item => item.id === action.candidateId && item.ownerId === actorId);
      if (!candidate || candidate.status !== 'available') return fail(state, '這位候選已不再可操作。');
      candidate.status = 'skipped';
      return state;
    }
    case 'PAUSE_DEMAND':
    case 'END_DEMAND': {
      if (!state.demand || state.demand.ownerId !== actorId) return fail(state, '找不到你正在尋找的請求。');
      if (['expired', 'ended'].includes(state.demand.status)) return fail(state, '這次請求已結束，請建立新的需求。');
      state.demand.status = action.type === 'PAUSE_DEMAND' ? 'paused' : 'ended';
      closePending(state, state.demand.id, 'withdrawn', action.type === 'PAUSE_DEMAND' ? '發起方已暫停找人' : '發起方已結束找人');
      return state;
    }
    case 'RESUME_DEMAND':
      if (!state.demand || state.demand.ownerId !== actorId || state.demand.status !== 'paused') return fail(state, '請重新確認需求與有效期限後再尋找。');
      state.demand.status = 'seeking';
      return state;
    case 'SEND_INVITATION': {
      const candidate = state.candidates.find(item => item.id === action.candidateId && item.ownerId === actorId);
      if (!candidate || !demandIsActive(state) || candidate.demandId !== state.demand.id || candidate.demandVersion !== state.demand.version) return fail(state, '候選或需求已失效，請重新尋找。');
      const existing = state.invitations.find(item => item.candidateId === candidate.id && item.status === 'pending');
      if (existing) return state;
      if (candidate.status !== 'available') return fail(state, '這位候選已不再可邀約，請重新尋找。');
      if (pairBlocked(state, actorId, candidate.userId)) return fail(state, '已封鎖這段聯繫，不能再次邀約。');
      if (action.fail) return fail(state, '邀約未送出，請再試一次。');
      const intro = action.intro === undefined ? state.demand.introSnapshot.intro : clean(action.intro);
      if (!intro) return fail(state, '請確認這次要分享的自我介紹。');
      const expiresAt = Math.min(state.demand.expiresAt, Number.isFinite(action.expiresAt) ? action.expiresAt : state.now + 2 * DAY);
      if (expiresAt <= state.now) return fail(state, '邀約期限已過，請重新確認。');
      state.invitations.push({
        id: nextId(state, 'invitation'), fromId: actorId, toId: candidate.userId, candidateId: candidate.id,
        demandId: state.demand.id, demandVersion: state.demand.version,
        snapshot: { name: state.users[actorId].name, intro, introVersion: state.users[actorId].introVersion },
        status: 'pending', createdAt: state.now, expiresAt, closedAt: null, closedReason: null, relationshipId: null,
      });
      candidate.status = 'invited';
      return state;
    }
    case 'ACCEPT_INVITATION':
    case 'DECLINE_INVITATION':
    case 'WITHDRAW_INVITATION': {
      const invitation = state.invitations.find(item => item.id === action.invitationId);
      if (!invitation) return fail(state, '這份邀約已不存在。');
      if (action.type === 'WITHDRAW_INVITATION' ? invitation.fromId !== actorId : invitation.toId !== actorId) return fail(state, '請切換到這份邀約對應的示範身份。');
      if (invitation.status === 'accepted' && action.type === 'ACCEPT_INVITATION') return state;
      if (invitation.status !== 'pending') return fail(state, invitation.closedReason || '邀約狀態已變更，不能再次操作。');
      if (!demandIsActive(state) || invitation.demandId !== state.demand.id || invitation.demandVersion !== state.demand.version) {
        invitation.status = 'withdrawn'; invitation.closedAt = state.now; invitation.closedReason = '原本的找人需求已失效';
        return fail(state, invitation.closedReason);
      }
      if (pairBlocked(state, invitation.fromId, invitation.toId)) return fail(state, '這段聯繫已停止，不能接受邀約。');
      invitation.status = action.type === 'ACCEPT_INVITATION' ? 'accepted' : action.type === 'DECLINE_INVITATION' ? 'declined' : 'withdrawn';
      invitation.closedAt = state.now;
      invitation.closedReason = invitation.status === 'declined' ? '對方這次選擇先不認識' : invitation.status === 'withdrawn' ? '發起方已撤回邀約' : null;
      if (invitation.status === 'accepted') {
        const existing = state.relationships.find(item => item.invitationId === invitation.id);
        if (existing) invitation.relationshipId = existing.id;
        else {
          const id = nextId(state, 'relationship');
          state.relationships.push({ id, invitationId: invitation.id, members: [invitation.fromId, invitation.toId], status: 'active', createdAt: state.now, endedAt: null });
          invitation.relationshipId = id;
        }
      }
      return state;
    }
    case 'COMPANION_SEND': {
      const text = clean(action.text);
      if (!text) return fail(state, '先寫一句想說的話吧。');
      const id = nextId(state, 'private-message');
      space.companionMessages.push({ id, role: 'user', text, createdAt: state.now });
      if (action.fail) { space.companionMessages.at(-1).status = 'failed'; return fail(state, '伙伴暫時沒有收到，內容已保留。'); }
      const wantsSocial = /朋友|認識|认识|看展|社交|拍照/.test(text);
      space.pendingDemandSuggestion = wantsSocial;
      space.companionMessages.push({ id: nextId(state, 'private-message'), role: 'assistant', text: wantsSocial ? '想找個朋友一起去嗎？我可以幫你整理需求。' : memoryReply(space), createdAt: state.now });
      if (/喜歡|喜欢|想先|希望/.test(text)) space.memory.push({ id: nextId(state, 'memory'), text, source: '這次私人對話', status: 'pending', updatedAt: state.now });
      return state;
    }
    case 'DISMISS_DEMAND_SUGGESTION':
    case 'CREATE_DEMAND_DRAFT':
      space.pendingDemandSuggestion = false;
      return state;
    case 'MEMORY_CONFIRM':
    case 'MEMORY_EDIT':
    case 'MEMORY_DELETE': {
      const memory = space.memory.find(item => item.id === action.memoryId);
      if (!memory || memory.status === 'deleted') return fail(state, '這條理解已移除。');
      if (action.type === 'MEMORY_EDIT' && !clean(action.text)) return fail(state, '請輸入修正後的內容。');
      memory.status = action.type === 'MEMORY_CONFIRM' ? 'confirmed' : action.type === 'MEMORY_EDIT' ? 'corrected' : 'deleted';
      if (action.type === 'MEMORY_EDIT') memory.text = clean(action.text);
      if (action.type === 'MEMORY_DELETE') memory.text = '';
      memory.updatedAt = state.now;
      return state;
    }
    case 'REQUEST_AI_DRAFT': {
      const relationship = relationshipForAction(state, action);
      if (!relationship || relationship.status !== 'active') return fail(state, '這段聯繫已結束，仍可以回到陪伴頁和伙伴聊天。');
      space.aiError = action.fail ? '這次建議未能完成，請再試一次。' : null;
      if (action.fail) return state;
      space.aiAdvice = '從一個輕鬆、具體的問題開始，留給對方回應的空間。這段建議只有你可見。';
      // Public drafting never reads another person's private demand or memories.
      space.aiDraft = '嗨，很高興認識你！最近有沒有甚麼喜歡的作品，或想一起聊聊的事？';
      return state;
    }
    case 'EDIT_AI_DRAFT': space.aiDraft = String(action.text ?? ''); return state;
    case 'USE_AI_DRAFT': space.publicDraft = space.aiDraft; return state;
    case 'SET_PUBLIC_DRAFT': space.publicDraft = String(action.text ?? ''); return state;
    case 'DISCARD_AI_DRAFT': space.aiDraft = ''; space.aiAdvice = ''; space.aiError = null; return state;
    case 'SEND_MESSAGE': {
      const relationship = relationshipForAction(state, action);
      if (!relationship || relationship.status !== 'active') return fail(state, '這段聯繫已結束，不能再發送訊息。');
      if (pairBlocked(state, ...relationship.members)) return fail(state, '這段聯繫已停止。');
      const text = clean(action.text === undefined ? space.publicDraft : action.text);
      if (!text) return fail(state, '請先輸入訊息。');
      if (action.clientId && state.messages.some(item => item.clientId === action.clientId && item.senderId === actorId && item.relationshipId === relationship.id)) return state;
      const id = nextId(state, 'message');
      state.messages.push({ id, clientId: action.clientId || id, relationshipId: relationship.id, senderId: actorId, text, status: action.fail ? 'failed' : 'sent', createdAt: state.now, isAI: false });
      space.publicDraft = '';
      return state;
    }
    case 'RETRY_MESSAGE': {
      const message = state.messages.find(item => item.id === action.messageId && item.senderId === actorId);
      if (!message) return fail(state, '找不到要重試的訊息。');
      const relationship = state.relationships.find(item => item.id === message.relationshipId);
      if (!relationship || relationship.status !== 'active' || pairBlocked(state, ...relationship.members)) return fail(state, '這段聯繫已結束，不能重新發送。');
      if (message.status === 'sent') return state;
      message.status = action.fail ? 'failed' : 'sent';
      return state;
    }
    case 'END_RELATIONSHIP':
    case 'BLOCK_RELATIONSHIP': {
      const relationship = relationshipForAction(state, action);
      if (!relationship) return fail(state, '找不到這段聯繫。');
      if (relationship.status === 'blocked') return state;
      relationship.status = action.type === 'BLOCK_RELATIONSHIP' ? 'blocked' : 'ended';
      relationship.endedAt = state.now;
      if (action.type === 'BLOCK_RELATIONSHIP') {
        const key = pairKey(...relationship.members);
        if (!state.blockedPairs.includes(key)) state.blockedPairs.push(key);
        // Blocking a person also closes a newer connection opened after an old
        // relationship ended; all views must reflect the pair-level block.
        for (const related of state.relationships) {
          if (related.status === 'active' && pairKey(...related.members) === key) {
            related.status = 'blocked';
            related.endedAt = state.now;
          }
        }
        for (const invitation of state.invitations) if (invitation.status === 'pending' && pairKey(invitation.fromId, invitation.toId) === key) {
          invitation.status = 'withdrawn'; invitation.closedAt = state.now; invitation.closedReason = '這份邀約已失效';
        }
        for (const candidate of state.candidates) if (pairKey(candidate.ownerId, candidate.userId) === key) candidate.status = 'expired';
      }
      return state;
    }
    case 'REPORT_RELATIONSHIP': {
      const relationship = relationshipForAction(state, action);
      if (!relationship) return fail(state, '找不到這段聯繫。');
      state.reports.push({ id: nextId(state, 'report'), reporterId: actorId, relationshipId: relationship.id, reason: clean(action.reason) || '不合適的互動', status: 'demo_recorded', createdAt: state.now });
      return state;
    }
    default: return fail(state, '這個操作暫時無法完成。');
  }
}

export function publicMessages(state, relationshipId, userId = active(state)) {
  const relationship = state.relationships.find(item => item.id === relationshipId && item.members.includes(userId));
  if (!relationship) return [];
  return state.messages.filter(item => item.relationshipId === relationshipId && (item.status === 'sent' || item.senderId === userId));
}

export function serializeState(state) { return JSON.stringify(state); }

export function hydrateState(serialized, now = Date.now()) {
  try {
    const state = typeof serialized === 'string' ? JSON.parse(serialized) : copy(serialized);
    if (state?.schemaVersion !== 1 || !state.users?.a || !state.users?.b || !state.private?.a || !state.private?.b || !state.session || !state.draft || !Number.isFinite(state.nextId) || !Number.isFinite(state.now)) return initialState(now);
    for (const field of ['candidates', 'invitations', 'relationships', 'messages', 'reports', 'blockedPairs']) if (!Array.isArray(state[field])) return initialState(now);
    for (const id of ['a', 'b']) if (!Array.isArray(state.private[id].memory) || !Array.isArray(state.private[id].companionMessages)) return initialState(now);
    for (const id of ['a', 'b']) {
      state.users[id].language ||= '粵語';
      state.users[id].region ||= '香港';
      state.users[id].companionName = 'Klin';
      state.users[id].cardTags = migrateCardTags(state.users[id].cardTags, state.users[id].cardLabels);
      state.users[id].cardLabels = {};
      state.users[id].cardAvatar = normalizeCardAvatar(state.users[id].cardAvatar);
      state.users[id].shareRegion = state.users[id].shareRegion === true;
      state.private[id].birth = { ...defaultBirth(id), ...(state.private[id].birth || {}) };
      state.private[id].companion = companionProfile(state, id);
      const welcome = state.private[id].companionMessages.find(message => message.id === `welcome-${id}`);
      if (welcome?.text === '嗨，我在這裡。我們可以慢慢認識，也可以一起找到聊得來的新朋友。') welcome.text = '今天想聊什麼？';
    }
    const savedOnboarding = state.onboarding && typeof state.onboarding === 'object' && !Array.isArray(state.onboarding) ? state.onboarding : {};
    const legacy = savedOnboarding.interaction === undefined && savedOnboarding.status === 'ready';
    const savedInteraction = savedOnboarding.interaction && typeof savedOnboarding.interaction === 'object' && !Array.isArray(savedOnboarding.interaction) ? savedOnboarding.interaction : {};
    const tone = legacy ? 'xin' : validMetalVoice(savedInteraction.tone) ? savedInteraction.tone : null;
    const interaction = { version: 1, greeted: legacy || savedInteraction.greeted === true, tone, response: legacy ? 'different' : tone && ['resonates', 'different'].includes(savedInteraction.response) ? savedInteraction.response : null };
    if (legacy || savedInteraction.migrated === true) interaction.migrated = true;
    state.onboarding = { ...newOnboarding(), ...savedOnboarding,
      basicsComplete: savedOnboarding.basicsComplete === true,
      birthComplete: savedOnboarding.birthComplete === true,
      status: ['new', 'preparing', 'failed', 'ready'].includes(savedOnboarding.status) ? savedOnboarding.status : 'new',
      interaction,
    };
    if (typeof state.session.activeUserId !== 'string' || !Object.hasOwn(state.users, state.session.activeUserId) || !Object.hasOwn(state.private, state.session.activeUserId)) state.session.activeUserId = 'a';
    state.now = Math.max(state.now, now);
    state.error = null;
    return expire(state);
  } catch { return initialState(now); }
}
import { migrateCardTags, normalizeCardAvatar } from './card-labels.mjs?v=20261015-universe-5';
