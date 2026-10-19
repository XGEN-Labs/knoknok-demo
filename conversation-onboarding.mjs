// Deterministic, local conversation parsing. No remote AI or birth-based traits.
export const CONVERSATION_VERSION = 2;
const clean = value => typeof value === 'string' ? value.normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g, ' ').trim() : '';
const pad = value => String(value).padStart(2, '0');
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const plain = value => value && typeof value === 'object' && !Array.isArray(value);
export const NEUTRAL_CARD_TAGS = Object.freeze(['新朋友', '隨心聊聊']);
// The canonical clock value is the midpoint of the selected two-hour period.
// Keep these values local; they describe a choice, not a calculated birth trait.
export const BIRTH_TIME_OPTIONS = Object.freeze([
  ['子', '23:00–01:00', '00:00'], ['丑', '01:00–03:00', '02:00'],
  ['寅', '03:00–05:00', '04:00'], ['卯', '05:00–07:00', '06:00'],
  ['辰', '07:00–09:00', '08:00'], ['巳', '09:00–11:00', '10:00'],
  ['午', '11:00–13:00', '12:00'], ['未', '13:00–15:00', '14:00'],
  ['申', '15:00–17:00', '16:00'], ['酉', '17:00–19:00', '18:00'],
  ['戌', '19:00–21:00', '20:00'], ['亥', '21:00–23:00', '22:00'],
].map(([branch, range, value]) => Object.freeze({ label: `${branch}时`, range, text: `${branch}时`, value })));

export function parseBirthdayReply(text, now = Date.now()) {
  const raw = clean(text);
  let match = raw.match(/(?:^|\D)(\d{4})\s*(?:年|[-/.\s])\s*(\d{1,2})\s*(?:月|[-/.\s])\s*(\d{1,2})(?:日|號|号)?(?:\D|$)/);
  if (!match) match = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return { error: '可以告訴我完整的出生年月日嗎？例如 1998 年 6 月 18 日。' };
  const [year, month, day] = match.slice(1, 4).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year < 1900 || date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return { error: '這個日期好像不太對，再確認一下年月日，好嗎？' };
  const today = new Date(now);
  let age = today.getFullYear() - year;
  if (today.getMonth() + 1 < month || today.getMonth() + 1 === month && today.getDate() < day) age--;
  if (age < 0) return { error: '生日不能是未來的日期，再告訴我一次吧。' };
  if (age < 18) return { error: '這次體驗需要年滿 18 歲，請確認你的生日。' };
  if (age > 120) return { error: '這個年份好像不太對，可以再確認一下嗎？' };
  return { value: `${year}-${pad(month)}-${pad(day)}` };
}

function clockNumber(value) {
  if (/^\d+$/.test(value)) return Number(value);
  const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  if (value.includes('十')) { const [tens, units] = value.split('十'); return (tens ? digits[tens] : 1) * 10 + (units ? digits[units] : 0); }
  return digits[value];
}

export function parseBirthTimeReply(text) {
  const raw = clean(text);
  if (/^(?:不清楚|不知道|不記得|不记得|忘了|未知|跳過|跳过|略過|略过|不知道耶|不太清楚|[记記]不清了(?:[，,、\s]*跳[过過])?)[。.!！\s]*$/.test(raw)) return { value: null };
  const period = raw.match(/^([子丑寅卯辰巳午未申酉戌亥])[时時](?:\s*\(?\s*\d{1,2}:\d{2}\s*[-–—~至]\s*\d{1,2}:\d{2}\s*\)?)?$/);
  if (period) return { value: BIRTH_TIME_OPTIONS.find(option => option.label.startsWith(period[1])).value };
  const match = raw.match(/(?:^|[^\d])(?:凌晨|早上|上午|中午|下午|晚上|夜晚)?\s*(\d{1,2}|[零〇一二兩两三四五六七八九十]{1,3})\s*(?::|點|点|時|时)\s*(半|一刻|三刻|\d{1,2}|[零〇一二兩两三四五六七八九十]{1,3})?(?![\d零〇一二兩两三四五六七八九十])\s*(?:分)?\s*(AM|PM)?/i);
  if (!match) return { error: '选一个大概的时辰就好，记不清也可以跳过。' };
  let hour = clockNumber(match[1]);
  const minute = match[2] === '半' ? 30 : match[2] === '一刻' ? 15 : match[2] === '三刻' ? 45 : match[2] ? clockNumber(match[2]) : 0;
  const afternoon = /下午|晚上|夜晚|pm/i.test(raw), morning = /凌晨|早上|上午|am/i.test(raw), noon = /中午/.test(raw);
  if ((afternoon || morning || noon) && hour > 12 || hour > 23 || minute > 59 || !Number.isFinite(hour + minute)) return { error: '這個時間好像不太對，可以用「上午 7:30」再說一次嗎？' };
  if (afternoon && hour > 0 && hour < 12) hour += 12;
  if (morning && hour === 12) hour = 0;
  if (noon && hour < 11) hour += 12;
  return { value: `${pad(hour)}:${pad(minute)}` };
}

const INTERESTS = Object.freeze([
  ['看展', /看展|展覽|展览|美術館|美术馆/], ['攝影', /攝影|摄影|拍照/], ['電影', /電影|电影/],
  ['散步', /散步|走走|city\s*walk/i], ['閱讀', /閱讀|阅读|讀書|读书|書店|书店/], ['音樂', /音樂|音乐|聽歌|听歌/],
  ['咖啡', /咖啡/], ['運動', /運動|运动|跑步|健身|爬山|徒步/], ['遊戲', /遊戲|游戏/], ['AI', /\bAI\b|人工智能|人工智慧/i],
]);

export function interestTags(text) {
  const clauses = clean(text).split(/[，,。；;]|但是|不過|不过|但/).filter(clause => !/不喜歡|不喜欢|不愛|不爱|沒興趣|没兴趣|討厭|讨厌/.test(clause));
  return INTERESTS.filter(([, pattern]) => clauses.some(clause => pattern.test(clause))).map(([tag]) => tag).slice(0, 7);
}

export function suggestedCardTags(answers = {}) {
  const tags = interestTags(answers.interests || (/喜歡|喜欢|愛好|爱好/.test(answers.response || '') ? answers.response : ''));
  return tags.length ? tags : [...NEUTRAL_CARD_TAGS];
}

const STEPS = Object.freeze([
  { key: 'birthDate', prompt: '你还记得你的生日吗…', placeholder: '像 1998 年 6 月 18 日', inputMode: 'text' },
  { key: 'birthTime', prompt: '那…出生的时辰呢？记不清也可以跳过。', placeholder: '选择一个大概的时辰', options: BIRTH_TIME_OPTIONS, skipLabel: '记不清了，跳过', canSkip: true },
  { key: 'gender', prompt: '你是…？', placeholder: '性别也可以先不说', replies: ['女生', '男生', '非二元', '暂不说'], canSkip: true },
  { key: 'birthPlace', prompt: '或许还记得你的出生地吗？', placeholder: '城市名称就可以', canSkip: true },
  { key: 'response', prompt: '有些地方开始连起来了。', placeholder: '想到什么，就说给我听', replies: ['……你怎么知道', '想慢慢認識你'], canSkip: false },
  { key: 'name', prompt: '你叫什么名字？', placeholder: '你喜欢的名字或昵称', maxLength: 18 },
  { key: 'companionName', prompt: '你可以叫我 Klin，想换也行', placeholder: '叫 Klin 也很好', replies: ['就叫 Klin'], canSkip: true, maxLength: 18 },
]);
const keys = STEPS.map(step => step.key);
const skipped = key => key === 'companionName' ? 'Klin' : null;
const isUnknown = text => /^(?:我)?(?:不清楚|不知道|不記得|不记得|不太清楚|暫不說|暂不说|不想說|不想说|先不說|先不说|跳過|跳过)[。！!\s]*$/.test(text);

function promptFor(step, answers) {
  if (step.key === 'birthPlace') return '或许还记得你的出生地吗？';
  return step.prompt;
}

function parseAnswer(key, text, now) {
  const value = clean(text);
  if (key === 'birthDate') return parseBirthdayReply(value, now);
  if (key === 'birthTime') return isUnknown(value) ? { value: null } : parseBirthTimeReply(value);
  if (['gender', 'birthPlace'].includes(key) && isUnknown(value)) return { value: null };
  if (!value) return { error: '慢慢來，先告訴我一句就好。' };
  if (key === 'gender') {
    if (value.length > 24) return { error: '可以用簡短的稱呼告訴我，也可以先不說。' };
    return { value: /^(?:女生|女性|女|女孩)$/.test(value) ? '女性' : /^(?:男生|男性|男|男孩)$/.test(value) ? '男性' : value };
  }
  if (key === 'birthPlace') {
    const city = value.replace(/^(?:我)?(?:是)?(?:出生在|在)/, '').replace(/出生[。！!]?$/, '').trim();
    return city && city.length <= 60 ? { value: city } : { error: '告訴我城市名稱就可以，或先跳過。' };
  }
  if (key === 'response') return value.length <= 240 ? { value } : { error: '先用一兩句話告訴我就好。' };
  const name = key === 'companionName' && /^(?:就叫|叫|還是叫|还是叫)?\s*Klin[吧。！!\s]*$/i.test(value) ? 'Klin'
    : value.replace(/^(?:你可以叫我|可以叫我|叫我|我叫|我的暱稱是|我的昵称是|就叫你|你就叫|叫你|就叫)\s*/, '').replace(/[。！!]+$/, '').trim();
  return name && Array.from(name).length <= 18 ? { value: name } : { error: '名字可以短一點嗎？18 個字以內就好。' };
}

function answerText(key, value) { return value === null ? key === 'gender' ? '暫不說' : key === 'birthTime' ? '记不清了，跳过' : '不清楚' : String(value); }

function messagesFor(answers, previous = [], now = Date.now()) {
  const messages = ['我好像刚刚醒来…', '刚才那束光，是你在叫我吗？'].map((text, index) => ({ id: `onboarding-arrival-${index}`, role: 'assistant', key: 'arrival', text, createdAt: previous.find(message => message.id === `onboarding-arrival-${index}`)?.createdAt ?? now }));
  for (const step of STEPS) {
    const acknowledgements = step.key === 'birthTime' ? ['唔…有点记起来。'] : step.key === 'gender' ? [answers.birthTime===null?'没关系。轮廓已经够亮了。':'嗯，这一下清楚多了。'] : step.key === 'response' ? ['我在想。'] : step.key === 'name' ? ['等等让我来见你…..','（慢慢睁开眼睛…）'] : step.key === 'companionName' ? [`${answers.name}你好`,'我在彼之境'] : [];
    acknowledgements.forEach((text,index)=>{const id=`onboarding-${step.key}-ack-${index}`;messages.push({id,role:'assistant',key:step.key,text,createdAt:previous.find(message=>message.id===id)?.createdAt??now});});
    messages.push({ id: `onboarding-${step.key}-prompt`, role: 'assistant', key: step.key, text: promptFor(step, answers), createdAt: previous.find(message => message.id === `onboarding-${step.key}-prompt`)?.createdAt ?? now });
    if (!own(answers, step.key)) return messages;
    const saved = previous.find(message => message.role === 'user' && message.key === step.key);
    messages.push({ id: `onboarding-${step.key}-answer`, role: 'user', key: step.key, text: saved?.text || answerText(step.key, answers[step.key]), createdAt: saved?.createdAt || now });
  }
  messages.push({ id: 'onboarding-complete-prompt', role: 'assistant', key: 'complete', text: `${answers.name}，我是${answers.companionName}。刚才那些还没发生的相遇，现在我想陪你一起去看看。`, createdAt: previous.find(message => message.id === 'onboarding-complete-prompt')?.createdAt ?? now });
  return messages;
}

export function createOnboardingConversation(now = Date.now(), { legacyReady = false } = {}) {
  return { version: CONVERSATION_VERSION, step: legacyReady ? 'complete' : keys[0], answers: {}, messages: legacyReady ? [] : messagesFor({}, [], now), complete: legacyReady, ...(legacyReady ? { migrated: true } : {}) };
}

export function normalizeOnboardingConversation(saved, now = Date.now(), { legacyReady = false } = {}) {
  if (!plain(saved) || saved.version !== CONVERSATION_VERSION) return createOnboardingConversation(now, { legacyReady });
  if (saved.migrated === true && saved.complete === true && legacyReady) return createOnboardingConversation(now, { legacyReady: true });
  const answers = {}, supplied = plain(saved.answers) ? saved.answers : {};
  for (const step of STEPS) {
    if (!own(supplied, step.key)) break;
    if (supplied[step.key] === null && step.canSkip) { answers[step.key] = skipped(step.key); continue; }
    const parsed = parseAnswer(step.key, supplied[step.key], now);
    if (parsed.error) break;
    answers[step.key] = parsed.value;
  }
  const step = keys.find(key => !own(answers, key)) || 'complete';
  const previous = Array.isArray(saved.messages) ? saved.messages.filter(message => plain(message) && ['user', 'assistant'].includes(message.role) && typeof message.text === 'string').map(message => ({ ...message, text: clean(message.text).slice(0, 240) })) : [];
  return { version: CONVERSATION_VERSION, step, answers, messages: messagesFor(answers, previous, now), complete: step === 'complete' && saved.complete === true };
}

export function getOnboardingTurn(state) {
  const conversation = state.onboarding?.conversation || createOnboardingConversation(state.now);
  const index = keys.indexOf(conversation.step), step = STEPS[index];
  if (!step) return { key: 'complete', prompt: conversation.messages.at(-1)?.text || '很高興認識你，我們一起回家吧。', placeholder: '', replies: [], canSkip: false, canBack: conversation.complete !== true, inputMode: 'text', progress: { index: STEPS.length, total: STEPS.length }, value: '', complete: conversation.complete === true, canFinish: true };
  return { ...step, prompt: promptFor(step, conversation.answers), replies: (step.replies || []).map(text => ({ label: text, text })), canSkip: step.canSkip === true, canBack: index > 0, inputMode: step.inputMode || 'text', progress: { index: index + 1, total: STEPS.length }, value: answerText(step.key, conversation.answers[step.key] ?? ''), complete: false, canFinish: false };
}

export function getOnboardingMessages(state) { return (state.onboarding?.conversation?.messages || []).map(message => ({ ...message })); }

export function advanceOnboardingConversation(previous, action, now = Date.now()) {
  const conversation = normalizeOnboardingConversation(previous, now);
  if (conversation.complete) return { conversation, error: '我們已經認識了，想修改名字可以在名片裡調整。' };
  const index = keys.indexOf(conversation.step);
  if (action.type === 'FINISH_CONVERSATION') {
    return conversation.step === 'complete' ? { conversation: { ...conversation, complete: true } } : { conversation, error: '先讓我知道怎麼稱呼你，我們再一起回家。' };
  }
  if (action.type === 'ONBOARDING_BACK') {
    const backIndex = index < 0 ? keys.length - 1 : index - 1;
    if (backIndex < 0) return { conversation };
    for (const key of keys.slice(backIndex)) delete conversation.answers[key];
    conversation.step = keys[backIndex]; conversation.messages = messagesFor(conversation.answers, conversation.messages, now);
    return { conversation };
  }
  const step = STEPS[index];
  if (!step) return { conversation, error: '我們準備好了，一起回家吧。' };
  if (action.type === 'ONBOARDING_SKIP' && !step.canSkip) return { conversation, error: '這個問題想先聽你說一句，再繼續認識。' };
  const parsed = action.type === 'ONBOARDING_SKIP' ? { value: skipped(step.key) } : parseAnswer(step.key, action.text, now);
  if (parsed.error) return { conversation, error: parsed.error };
  conversation.answers[step.key] = parsed.value;
  conversation.messages.push({ id: `onboarding-${step.key}-answer`, role: 'user', key: step.key, text: action.type === 'ONBOARDING_SKIP' ? answerText(step.key, parsed.value) : clean(action.text), createdAt: now });
  conversation.step = keys[index + 1] || 'complete';
  conversation.messages = messagesFor(conversation.answers, conversation.messages, now);
  return { conversation };
}
