// Local demo only. No credentials, network requests or real messages are stored/sent.
import { METAL_VOICES, landingComplete, accountLandingComplete, validMetalVoice } from './landing.mjs';
import { interestTags, suggestedCardTags, NEUTRAL_CARD_TAGS, createOnboardingConversation, normalizeOnboardingConversation, advanceOnboardingConversation } from './conversation-onboarding.mjs';
export { BIRTH_TIME_OPTIONS, getOnboardingTurn, getOnboardingMessages } from './conversation-onboarding.mjs';
export const STORAGE_KEY = 'knokknok-prototype-v1';
const DAY = 24 * 60 * 60 * 1000;
const copy = value => JSON.parse(JSON.stringify(value));
const clean = value => typeof value === 'string' ? value.trim() : '';
const active = state => state.session.activeUserId;
const nextId = (state, prefix) => `${prefix}-${state.nextId++}`;
const pairKey = (a, b) => [a, b].sort().join(':');
const pairBlocked = (state, a, b) => state.blockedPairs.includes(pairKey(a, b));
const fail = (state, message) => { state.error = message; return state; };
const newOnboarding = (now = Date.now()) => ({ basicsComplete: false, birthComplete: false, status: 'new', initializedAt: null, error: null, contractRequired: true, contract: null, interaction: { version: 1, greeted: false, tone: null, response: null }, conversation: createOnboardingConversation(now) });
const defaultBirth = ownerId => ({ date: ownerId === 'a' ? '1998-06-18' : '', time: '', unknownTime: true, place: '', timezone: '' });
const newCompanion = (stage = 'juvenile', grownAt = null, name = 'Klin') => ({ id: 'klin', name, element: 'metal', stage, grownAt: stage === 'adult' ? grownAt : null });
const newSocialIntent = () => ({ step: 'idle', topic: '', pace: '', status: 'idle', friendIds: [], selectedRelationshipId: null });

function normalizedContract(value, now) {
  if (!value || value.version !== 1 || !Number.isFinite(value.signedAt) || value.signedAt < 0 || value.signedAt > now) return null;
  const userName = clean(value.userName), companionName = clean(value.companionName);
  if (!userName || !companionName || Array.from(userName).length > 18 || Array.from(companionName).length > 18) return null;
  return { version: 1, signedAt: value.signedAt, userName, companionName };
}

/** Older completed saves remain usable without fabricating a signed contract. */
export function hasSignedCompanionContract(state) {
  if (accountLandingComplete(state)) return true;
  const onboarding = state.onboarding, conversation = onboarding?.conversation;
  if (onboarding?.contractRequired === false && onboarding.status === 'ready' && conversation?.complete === true) return true;
  const contract = normalizedContract(onboarding?.contract, state.now);
  if (!contract) return false;
  if (conversation?.complete === true) return true;
  return conversation?.step === 'complete' && contract.userName === conversation.answers?.name && contract.companionName === conversation.answers?.companionName;
}

export const DEMO_FRIENDS = Object.freeze([
  Object.freeze({ id: 'b', name: '阿朗', initial: '朗', interests: Object.freeze(['攝影', '看展']), recent: '剛看完一個攝影展，想交換幾張喜歡的照片。', greeting: '你好，我是阿朗。最近有看到讓你想停下來的畫面嗎？' }),
  Object.freeze({ id: 'c', name: '小雨', initial: '雨', interests: Object.freeze(['閱讀', '咖啡']), recent: '找到一家安靜的小書店，正在讀一本散文。', greeting: '嗨，我是小雨。今天有什麼小事讓你心情好一點嗎？' }),
  Object.freeze({ id: 'd', name: '阿哲', initial: '哲', interests: Object.freeze(['散步', '音樂']), recent: '最近喜歡傍晚散步，順便收集新的歌單。', greeting: '你好，我是阿哲。你散步時會聽音樂，還是聽城市的聲音？' }),
]);

export function getDemoFriends(state, userId = active(state)) {
  return DEMO_FRIENDS.filter(friend => friend.id !== userId && !pairBlocked(state, userId, friend.id) &&
    !state.relationships.some(item => item.id === `demo-friend-${pairKey(userId, friend.id).replace(':', '-')}` && item.status !== 'active')).map(friend => {
    const relationship = state.relationships.find(item => item.members.includes(userId) && item.members.includes(friend.id) && item.status === 'active');
    return { ...friend, interests: [...friend.interests], isSimulated: true, relationshipId: relationship?.id || `demo-friend-${pairKey(userId, friend.id).replace(':', '-')}`, connected: Boolean(relationship) };
  });
}

export const SHARED_MOMENT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'walk', label: '一起走走', detail: '留一点时间，去看看路上的风景。' }),
  Object.freeze({ id: 'stay', label: '安静坐坐', detail: '不急着出发，先在这里待一会儿。' }),
]);

export function getCompanionTurn(state, userId = active(state)) {
  const intent = state.private[userId]?.socialIntent || newSocialIntent();
  const replies = intent.step === 'topic' ? ['一起看展', '散步聊聊天', '分享最近的日常']
    : intent.step === 'pace' ? ['先輕鬆聊聊', '慢慢熟悉', '找時間一起出門']
    : intent.step === 'confirm' ? ['好，幫我找找', '再想一下'] : [];
  const friends = intent.status === 'matched' ? getDemoFriends(state, userId).filter(friend => intent.friendIds.includes(friend.id)) : [];
  return { key: intent.step, replies: replies.map(text => ({ label: text, text })), friends, topic: intent.topic, pace: intent.pace, status: intent.status, relationshipId: intent.selectedRelationshipId };
}

function socialReply(state, space, text) {
  const intent = space.socialIntent ||= newSocialIntent();
  const cancelled = /先不要|暫時不要|暂时不要|再想|不找了|取消|先不找|算了/.test(text);
  const wantsSocial = /(?:想|希望|幫我|帮我|可以|能不能).{0,18}(?:認識|认识|朋友|交友|找人|找個人|找个人)|(?:交|找)(?:個|个|些)?(?:新)?朋友/.test(text) && !/不想|不希望|不要/.test(text);
  const topic = interestTags(text).join('、');
  if (intent.step !== 'idle' && cancelled) {
    space.socialIntent = newSocialIntent();
    return '好，不急著找。我留在這裡，先陪你聊聊。';
  }
  if (intent.step === 'confirm') {
    if (/^(?:好[的呀啊吧]?|可以|確認|确认|幫我找找|帮我找找|去找吧|拜託你了|拜托你了|嗯)[，,。！!\s]*(?:幫我|帮我|請|请)?(?:找找|找朋友|去找|開始|开始)?[吧呀啊。！!\s]*$/.test(text)) {
      intent.step = 'complete'; intent.status = 'matched';
      intent.friendIds = getDemoFriends(state).map(friend => friend.id);
      return '好，幾位可以聊聊的朋友，已經在串門裡了。去打個招呼吧。';
    }
    if (topic) { intent.topic = topic; return `那就從${topic}開始，照「${intent.pace}」的步調。要我幫你找找嗎？`; }
    return '不用急，想好了再說「好，幫我找找」，我才會開始。也可以說「再想一下」。';
  }
  if (intent.step === 'topic') {
    if (text.length > 120) return '先用一句話告訴我，想和新朋友一起做什麼就好。';
    intent.topic = topic || text; intent.step = 'pace';
    return `好，一起${intent.topic.replace(/^一起/, '')}。你想先輕鬆聊聊，還是慢慢熟悉再約出門？`;
  }
  if (intent.step === 'pace') {
    if (text.length > 120) return '你希望用什麼步調認識彼此？像「先輕鬆聊聊」就可以。';
    intent.pace = text; intent.step = 'confirm';
    return `我懂了，想一起${intent.topic.replace(/^一起/, '')}，照「${intent.pace}」的步調。要我幫你找找嗎？`;
  }
  if (wantsSocial) {
    space.socialIntent = { ...newSocialIntent(), step: topic ? 'pace' : 'topic', topic, status: 'draft' };
    return topic ? `一起${topic}，聽起來不錯。你想先輕鬆聊聊，還是慢慢熟悉再約出門？` : '好呀。你想和新朋友一起做點什麼？';
  }
  return null;
}

/** The default companion keeps its identity throughout onboarding and later visits. */
export function companionProfile(state, userId = active(state)) {
  const saved = state.private?.[userId]?.companion;
  const legacyAdult = userId !== 'a' || state.onboarding?.status === 'ready';
  const stage = ['juvenile', 'adult'].includes(saved?.stage) ? saved.stage : legacyAdult ? 'adult' : 'juvenile';
  const grownAt = Number.isFinite(saved?.grownAt) ? saved.grownAt
    : userId === 'a' && Number.isFinite(state.onboarding?.initializedAt) ? state.onboarding.initializedAt : state.now;
  return newCompanion(stage, grownAt, clean(state.users?.[userId]?.companionName) || 'Klin');
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
    companion: newCompanion(ownerId === 'a' ? 'juvenile' : 'adult', now),
    memory: ownerId === 'a' ? [
      { id: 'memory-initial-1', text: '最近工作有點累', source: '示範私人對話', status: 'confirmed', updatedAt: now },
      { id: 'memory-initial-2', text: '認識新朋友時，想先從文字聊天開始', source: '伙伴的待確認理解', status: 'pending', updatedAt: now },
    ] : [],
    companionMessages: [{ id: `welcome-${ownerId}`, role: 'assistant', text: '今天想聊什麼？', createdAt: now }],
    aiDraft: '', aiAdvice: '', aiError: null, publicDraft: '', pendingDemandSuggestion: false, socialIntent: newSocialIntent(),
  };
}

export function initialState(now = Date.now()) {
  return {
    schemaVersion: 1, now, nextId: 1, error: null,
    session: { authenticated: false, activeUserId: 'a', provider: null },
    onboarding: newOnboarding(now),
    users: {
      a: { id: 'a', name: 'Frank', language: '粵語', region: '香港', bio: '喜歡發掘城市裡的小展覽。', introVersion: 1, isSimulated: true, companionName: 'Klin', cardLabels: {}, cardTags: [], cardTagsEdited: false, cardAvatar: '', shareRegion: false },
      b: { id: 'b', name: '阿朗', language: '粵語', region: '香港', bio: '喜歡攝影、展覽和慢慢聊天。', introVersion: 1, isSimulated: true, companionName: 'Klin', cardLabels: {}, cardTags: [], cardTagsEdited: true, cardAvatar: '', shareRegion: false },
      c: { id: 'c', name: '小雨', language: '粵語', region: '香港', bio: '喜歡閱讀、咖啡和安靜的小書店。', introVersion: 1, isSimulated: true, companionName: 'Klin', cardLabels: {}, cardTags: ['閱讀', '咖啡'], cardTagsEdited: true, cardAvatar: '', shareRegion: false },
      d: { id: 'd', name: '阿哲', language: '粵語', region: '香港', bio: '喜歡散步、音樂和城市裡的小發現。', introVersion: 1, isSimulated: true, companionName: 'Klin', cardLabels: {}, cardTags: ['散步', '音樂'], cardTagsEdited: true, cardAvatar: '', shareRegion: false },
    },
    private: { a: privateSpace('a', now), b: privateSpace('b', now), c: privateSpace('c', now), d: privateSpace('d', now) },
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

/** Later edits update saved details without replaying the first encounter. */
export function validateAccountProfile(profile = {}, now = Date.now()) {
  const errors = validateBasics(profile);
  for (const [key, limit, message] of [
    ['name', 18, '名字請保持在 18 個字以內。'],
    ['language', 24, '請選擇有效的對話語言。'],
    ['region', 60, '城市名稱請保持在 60 個字以內。'],
    ['companionName', 18, '伙伴的名字請保持在 18 個字以內。'],
    ['gender', 24, '性別稱呼請保持在 24 個字以內。'],
  ]) if (Array.from(clean(profile[key])).length > limit) errors[key] = message;
  if (!clean(profile.companionName)) errors.companionName = '請填寫伙伴的名字。';
  const birth = profile.birth && typeof profile.birth === 'object' && !Array.isArray(profile.birth) ? profile.birth : {};
  const birthErrors = validateBirth(birth, now);
  if (birthErrors.date) errors.birthDate = birthErrors.date;
  if (birthErrors.time) errors.birthTime = birthErrors.time;
  if (Array.from(clean(birth.place)).length > 60) errors.birthPlace = '出生地請保持在 60 個字以內。';
  if (Array.from(clean(birth.timezone)).length > 60) errors.timezone = '請選擇有效的出生時區。';
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
    case 'SIGN_COMPANION_CONTRACT': {
      if (actorId !== 'a') return fail(state, '這位伙伴已經有自己的約定。');
      if (hasSignedCompanionContract(state)) return state;
      const savedConversation = state.onboarding.conversation;
      const initializedLegacyFlow = savedConversation?.migrated === true && savedConversation.complete === true && state.onboarding.status === 'ready' && state.onboarding.basicsComplete && state.onboarding.birthComplete;
      const conversation = normalizeOnboardingConversation(savedConversation, state.now, { legacyReady: initializedLegacyFlow });
      const answers = conversation.answers;
      const naturalReady = conversation.step === 'complete' && clean(answers.name) && clean(answers.companionName);
      if (!naturalReady && !initializedLegacyFlow) return fail(state, '先讓我知道怎麼稱呼你，再一起許下約定。');
      state.onboarding.contract = { version: 1, signedAt: state.now,
        userName: naturalReady ? answers.name : state.users.a.name,
        companionName: naturalReady ? answers.companionName : state.users.a.companionName };
      return state;
    }
    case 'ONBOARDING_REPLY':
    case 'ONBOARDING_BACK':
    case 'ONBOARDING_SKIP':
    case 'FINISH_CONVERSATION': {
      if (actorId !== 'a') return fail(state, '這位伙伴已經認識你了。');
      if (state.onboarding.conversation?.complete === true) return action.type === 'FINISH_CONVERSATION' ? state : fail(state, '已經準備好了，我們一起回家吧。');
      if (action.type === 'FINISH_CONVERSATION' && !hasSignedCompanionContract(state)) return fail(state, '先和我許下陪伴的約定，再一起回家吧。');
      const result = advanceOnboardingConversation(state.onboarding.conversation, action, state.now);
      if (result.error) return fail(state, result.error);
      state.onboarding.conversation = result.conversation;
      if (action.type === 'ONBOARDING_BACK') state.onboarding.contract = null;
      state.onboarding.interaction.greeted = true;
      const answers = result.conversation.answers;
      space.birth = {
        date: answers.birthDate || '', time: answers.birthTime || '', unknownTime: !answers.birthTime,
        place: answers.birthPlace || '', timezone: space.birth.timezone || '',
      };
      space.about = { ...(space.about || {}), gender: answers.gender || '' };
      if (answers.name) state.users.a.name = answers.name;
      if (answers.companionName) {
        state.users.a.companionName = answers.companionName;
        space.companion.name = answers.companionName;
      }
      state.onboarding.error = null;
      if (action.type === 'FINISH_CONVERSATION') {
        state.onboarding.status = 'ready'; state.onboarding.basicsComplete = true; state.onboarding.birthComplete = true;
        state.onboarding.initializedAt ||= state.now;
        if (!state.users.a.cardTagsEdited) state.users.a.cardTags = suggestedCardTags(answers);
        if (state.users.a.bio === '喜歡發掘城市裡的小展覽。') {
          const tags = interestTags(/喜歡|喜欢|愛好|爱好/.test(answers.response || '') ? answers.response : '');
          state.users.a.bio = tags.length ? `喜歡${tags.join('、')}，想和新朋友慢慢聊聊。` : '想和新朋友，慢慢聊些喜歡的事。';
        }
        const welcome = space.companionMessages.find(message => message.id === 'welcome-a');
        if (welcome?.text === '今天想聊什麼？') welcome.text = `${answers.name}，我是${answers.companionName}。今天想先和我聊些什麼？`;
      }
      return state;
    }
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
      state.onboarding.conversation = createOnboardingConversation(state.now, { legacyReady: true });
      return state;
    case 'ENTER_COMPANION_HOME':
      if (actorId === 'a' && state.onboarding.status !== 'ready' && !accountLandingComplete(state)) return fail(state, '請先完成資料確認，讓 Klin 準備好陪伴你。');
      if (actorId === 'a' && !hasSignedCompanionContract(state)) return fail(state, '先和我許下陪伴的約定，再一起回家吧。');
      if (!landingComplete(state)) return fail(state, '先和 Klin 慢慢認識，再一起回家。');
      space.companion = companionProfile(state, actorId);
      if (space.companion.stage === 'juvenile') space.companion = newCompanion('adult', state.now, state.users[actorId].companionName);
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
        state.users[actorId].cardTagsEdited = true;
      }
      if (patch.cardAvatar !== undefined) state.users[actorId].cardAvatar = normalizeCardAvatar(patch.cardAvatar);
      if (patch.shareRegion !== undefined) state.users[actorId].shareRegion = patch.shareRegion === true;
      state.users[actorId].introVersion += 1;
      return state;
    }
    case 'UPDATE_ACCOUNT_PROFILE': {
      if (!landingComplete(state)) return fail(state, '先完成這次相遇，再編輯已保存的資料。');
      const patch = action.patch && typeof action.patch === 'object' && !Array.isArray(action.patch) ? action.patch : {};
      const user = state.users[actorId];
      const profile = {
        name: patch.name === undefined ? user.name : patch.name,
        language: patch.language === undefined ? user.language : patch.language,
        region: patch.region === undefined ? user.region : patch.region,
        companionName: patch.companionName === undefined ? user.companionName : patch.companionName,
        gender: patch.gender === undefined ? space.about?.gender || '' : patch.gender,
        birth: { ...space.birth, ...(patch.birth && typeof patch.birth === 'object' && !Array.isArray(patch.birth) ? patch.birth : {}) },
      };
      const errors = validateAccountProfile(profile, state.now);
      if (Object.keys(errors).length) return fail(state, Object.values(errors)[0]);
      const publicChanged = ['name', 'language', 'region'].some(key => user[key] !== clean(profile[key]));
      for (const key of ['name', 'language', 'region', 'companionName']) user[key] = clean(profile[key]);
      if (publicChanged) user.introVersion += 1;
      space.birth = { date: clean(profile.birth.date), time: profile.birth.unknownTime ? '' : clean(profile.birth.time), unknownTime: Boolean(profile.birth.unknownTime), place: clean(profile.birth.place), timezone: clean(profile.birth.timezone) };
      space.about = { ...(space.about || {}), gender: clean(profile.gender) };
      space.companion = { ...space.companion, name: user.companionName };
      // The original conversation, paper agreement and all later messages are history.
      // Do not rewrite them or change onboarding / growth state for a profile edit.
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
    case 'COMPANION_REQUEST': {
      const text = clean(action.text);
      if (!text || !action.id) return fail(state, '先寫一句想說的話吧。');
      const existing = space.companionMessages.find(message => message.id === action.id);
      if (existing) {
        if (existing.role !== 'user' || existing.status !== 'failed') return state;
        existing.status = 'pending'; delete existing.error;
        // A retry is a new send after any intervening completed turns.
        space.companionMessages.splice(space.companionMessages.indexOf(existing), 1);
        space.companionMessages.push(existing);
      } else {
        space.companionMessages.push({ id: action.id, role: 'user', text, source: 'model', status: 'pending', createdAt: state.now });
      }
      return state;
    }
    case 'COMPANION_RESOLVE': {
      const message = space.companionMessages.find(message => message.id === action.id);
      if (!message || message.status !== 'pending' || !clean(action.text)) return state;
      message.status = 'complete';
      space.companionMessages.push({
        id: nextId(state, 'private-message'), role: 'assistant', text: action.text,
        status: 'complete', source: 'model', provider: action.provider,
        fallback: action.fallback === true, createdAt: state.now,
      });
      return state;
    }
    case 'COMPANION_REJECT': {
      const message = space.companionMessages.find(message => message.id === action.id);
      if (message?.status === 'pending') { message.status = 'failed'; message.error = action.error; }
      return state;
    }
    case 'COMPANION_SEND': {
      const text = clean(action.text);
      if (!text) return fail(state, '先寫一句想說的話吧。');
      const id = nextId(state, 'private-message');
      space.companionMessages.push({ id, role: 'user', text, createdAt: state.now });
      if (action.fail) { space.companionMessages.at(-1).status = 'failed'; return fail(state, '伙伴暫時沒有收到，內容已保留。'); }
      const reply = socialReply(state, space, text);
      space.pendingDemandSuggestion = false;
      space.companionMessages.push({ id: nextId(state, 'private-message'), role: 'assistant', text: reply || memoryReply(space), createdAt: state.now });
      if (/喜歡|喜欢|想先|希望/.test(text)) space.memory.push({ id: nextId(state, 'memory'), text, source: '這次私人對話', status: 'pending', updatedAt: state.now });
      return state;
    }
    case 'OPEN_DEMO_FRIEND': {
      const friend = DEMO_FRIENDS.find(item => item.id === action.friendId);
      if (!friend || friend.id === actorId || pairBlocked(state, actorId, friend.id)) return fail(state, '這位朋友暫時無法開始對話。');
      let relationship = state.relationships.find(item => item.members.includes(actorId) && item.members.includes(friend.id) && item.status === 'active');
      if (!relationship) {
        const id = `demo-friend-${pairKey(actorId, friend.id).replace(':', '-')}`;
        if (state.relationships.some(item => item.id === id)) return fail(state, '這段示範聯繫已結束。');
        relationship = { id, invitationId: null, members: [actorId, friend.id], status: 'active', createdAt: state.now, endedAt: null, isSimulated: true };
        state.relationships.push(relationship);
        state.messages.push({ id: nextId(state, 'message'), relationshipId: id, senderId: friend.id, text: friend.greeting, status: 'sent', createdAt: state.now, isAI: false, isSimulated: true });
      }
      space.socialIntent ||= newSocialIntent(); space.socialIntent.selectedRelationshipId = relationship.id;
      return state;
    }
    case 'CHOOSE_SHARED_MOMENT': {
      const relationship = relationshipForAction(state, action);
      if (!relationship || relationship.status !== 'active' || pairBlocked(state, ...relationship.members)) return fail(state, '这间共同小屋暂时无法参与。');
      if (!SHARED_MOMENT_OPTIONS.some(option => option.id === action.choice)) return fail(state, '先选一张你喜欢的回响。');
      if (relationship.sharedMoment?.completedAt) return state;
      const moment = relationship.sharedMoment ||= { choices: {}, confirmed: {}, completedAt: null };
      moment.choices[actorId] = action.choice; moment.confirmed[actorId] = false;
      // Only the explicitly simulated prototype neighbour may respond locally.
      if (action.simulatePartner === true && relationship.isSimulated === true) {
        const partner = relationship.members.find(id => id !== actorId);
        moment.choices[partner] = partner === 'c' ? 'stay' : 'walk'; moment.confirmed[partner] = true;
      }
      return state;
    }
    case 'KEEP_SHARED_MOMENT': {
      const relationship = relationshipForAction(state, action);
      if (!relationship || relationship.status !== 'active' || pairBlocked(state, ...relationship.members)) return fail(state, '这间共同小屋暂时无法参与。');
      const moment = relationship.sharedMoment;
      if (!moment || !relationship.members.every(id => SHARED_MOMENT_OPTIONS.some(option => option.id === moment.choices[id]))) return fail(state, '等两个人都选好，再一起留下来。');
      if (moment.completedAt) return state;
      moment.confirmed[actorId] = true;
      if (relationship.members.every(id => moment.confirmed[id] === true)) moment.completedAt = state.now;
      return state;
    }
    case 'DISMISS_DEMAND_SUGGESTION':
    case 'CREATE_DEMAND_DRAFT':
      space.pendingDemandSuggestion = false;
      space.socialIntent = newSocialIntent();
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
    const defaults = initialState(now);
    const savedOnboarding = state.onboarding && typeof state.onboarding === 'object' && !Array.isArray(state.onboarding) ? state.onboarding : {};
    const ready = savedOnboarding.status === 'ready' && savedOnboarding.basicsComplete === true && savedOnboarding.birthComplete === true;
    for (const id of ['c', 'd']) {
      state.users[id] ||= defaults.users[id];
      state.private[id] ||= defaults.private[id];
      if (!Array.isArray(state.private[id].memory) || !Array.isArray(state.private[id].companionMessages)) state.private[id] = defaults.private[id];
    }
    for (const id of ['a', 'b', 'c', 'd']) {
      state.users[id].language ||= '粵語';
      state.users[id].region ||= '香港';
      const companionName = clean(state.users[id].companionName);
      const legacyKnok = companionName === 'Knok' && (savedOnboarding.conversation?.version !== 2 || savedOnboarding.conversation?.migrated === true);
      state.users[id].companionName = companionName && Array.from(companionName).length <= 18 && !legacyKnok ? companionName : 'Klin';
      const savedTagsEdited = state.users[id].cardTagsEdited;
      const savedTags = migrateCardTags(state.users[id].cardTags, state.users[id].cardLabels);
      // Old empty cards gain neutral defaults. An explicit edit, including [], stays authoritative.
      state.users[id].cardTagsEdited = savedTagsEdited === true || savedTagsEdited === undefined && savedTags.length > 0;
      state.users[id].cardTags = savedTagsEdited === undefined && savedTags.length === 0 ? [...NEUTRAL_CARD_TAGS] : savedTags;
      state.users[id].cardLabels = {};
      state.users[id].cardAvatar = normalizeCardAvatar(state.users[id].cardAvatar);
      state.users[id].shareRegion = state.users[id].shareRegion === true;
      state.private[id].birth = { ...defaultBirth(id), ...(state.private[id].birth || {}) };
      state.private[id].companion = companionProfile(state, id);
      state.private[id].pendingDemandSuggestion = false;
      const savedIntent = state.private[id].socialIntent;
      const intent = newSocialIntent();
      if (savedIntent && typeof savedIntent === 'object' && !Array.isArray(savedIntent)) {
        intent.topic = clean(savedIntent.topic).slice(0, 120);
        intent.pace = clean(savedIntent.pace).slice(0, 120);
        if (['topic', 'pace', 'confirm', 'complete'].includes(savedIntent.step)) intent.step = savedIntent.step;
        if (['pace', 'confirm', 'complete'].includes(intent.step) && !intent.topic) intent.step = 'topic';
        if (['confirm', 'complete'].includes(intent.step) && !intent.pace) intent.step = 'pace';
        intent.status = intent.step === 'idle' ? 'idle' : intent.step === 'complete' && savedIntent.status === 'matched' ? 'matched' : 'draft';
        if (intent.step === 'complete' && intent.status !== 'matched') intent.step = 'confirm';
        const available = getDemoFriends(state, id).map(friend => friend.id);
        intent.friendIds = intent.status === 'matched' && Array.isArray(savedIntent.friendIds) ? [...new Set(savedIntent.friendIds.filter(friendId => available.includes(friendId)))] : [];
        const selected = state.relationships.find(item => item.id === savedIntent.selectedRelationshipId && item.members.includes(id));
        intent.selectedRelationshipId = selected?.id || null;
      }
      state.private[id].socialIntent = intent;
      const welcome = state.private[id].companionMessages.find(message => message.id === `welcome-${id}`);
      if (welcome?.text === '嗨，我在這裡。我們可以慢慢認識，也可以一起找到聊得來的新朋友。') welcome.text = '今天想聊什麼？';
    }
    const legacy = savedOnboarding.interaction === undefined && savedOnboarding.status === 'ready';
    const savedInteraction = savedOnboarding.interaction && typeof savedOnboarding.interaction === 'object' && !Array.isArray(savedOnboarding.interaction) ? savedOnboarding.interaction : {};
    const tone = legacy ? 'xin' : validMetalVoice(savedInteraction.tone) ? savedInteraction.tone : null;
    const interaction = { version: 1, greeted: legacy || savedInteraction.greeted === true, tone, response: legacy ? 'different' : tone && ['resonates', 'different'].includes(savedInteraction.response) ? savedInteraction.response : null };
    if (legacy || savedInteraction.migrated === true) interaction.migrated = true;
    state.onboarding = { ...newOnboarding(now), ...savedOnboarding,
      basicsComplete: savedOnboarding.basicsComplete === true,
      birthComplete: savedOnboarding.birthComplete === true,
      status: ['new', 'preparing', 'failed', 'ready'].includes(savedOnboarding.status) ? savedOnboarding.status : 'new',
      // Only a pre-contract completed save is exempt. In-progress saves and
      // current saves retain the explicit signing gate after a refresh.
      contractRequired: ready && !Object.hasOwn(savedOnboarding, 'contractRequired') ? false : savedOnboarding.contractRequired === false && ready ? false : true,
      contract: normalizedContract(savedOnboarding.contract, Math.max(state.now, now)),
      interaction,
      conversation: normalizeOnboardingConversation(savedOnboarding.conversation, now, { legacyReady: ready }),
    };
    if (typeof state.session.activeUserId !== 'string' || !Object.hasOwn(state.users, state.session.activeUserId) || !Object.hasOwn(state.private, state.session.activeUserId)) state.session.activeUserId = 'a';
    state.now = Math.max(state.now, now);
    state.error = null;
    return expire(state);
  } catch { return initialState(now); }
}
import { migrateCardTags, normalizeCardAvatar } from './card-labels.mjs?v=20261021-refine-27c';
