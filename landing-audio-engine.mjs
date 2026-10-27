import { LANDING_FILM_AUDIO, LANDING_MUSIC, LANDING_VOICE_CLIPS, LANDING_VOICE_TEMPLATES } from './landing-audio-clips.mjs?v=20261027-audio-61';
import { ROOM_VOICE_CLIPS } from './room-voice-clips.mjs?v=20261026-room-voice-47';
import { ROOM_VOICE_PROFILE, isRoomNarration, isMandarin, findLocalLandingVoice } from './room-voice-profile.mjs?v=20261026-room-voice-47';

const normalize = value => String(value || '').normalize('NFKC').replace(/\.{2,}/g, '…').replace(/\s+/g, ' ').trim();
const clips = new Map(LANDING_VOICE_CLIPS.map(clip => [normalize(clip.text), clip.src]));
const roomClips = new Map(ROOM_VOICE_CLIPS.map(clip => [normalize(clip.text), clip.src]));
function clipFor(job) {
  if (!isMandarin(job.lang)) return null;
  const text = normalize(job.text), exact = (isRoomNarration(job.scope) ? roomClips.get(text) : null) || clips.get(text);
  if (exact) return exact;
  if (!job.scope.startsWith('landing:')) return null;
  // Names remain in the visible dialogue. These three recorded sentence bodies
  // keep the same character voice without splicing in a device-generated name.
  if (/^.{1,18}你好[。!！]*$/u.test(text)) return LANDING_VOICE_TEMPLATES.namedGreeting.src;
  if (/^.+,我是.+。刚才那些还没发生的相遇,现在我想陪你一起去看看。$/u.test(text)) return LANDING_VOICE_TEMPLATES.namedComplete.src;
  if (/^.+,把這次相遇留下來吧。你願意和我簽下這份契約嗎[?？]$/u.test(text)) return LANDING_VOICE_TEMPLATES.contractInvite.src;
  return null;
}
export function audioLanguage(value = 'zh-CN') {
  return ({ '粵語': 'zh-HK', '粤语': 'zh-HK', '普通話': 'zh-CN', '普通话': 'zh-CN', '英語': 'en-US', '英语': 'en-US' })[value] || value;
}

/** A single explicit sound switch owns film music, dialogue and effect cues.
 * Callers supply stable message keys. Re-rendering never replays a key.
 */
export function createLandingAudio({ environment = {} } = {}) {
  const doc = environment.documentRef ?? globalThis.document;
  const AudioContext = environment.AudioContext ?? globalThis.AudioContext ?? globalThis.webkitAudioContext;
  const fetchAudio = environment.fetch ?? globalThis.fetch?.bind(globalThis);
  const resolveAudioURL = environment.resolveAudioURL ?? (src => new URL(src, import.meta.url).href);
  const synthesis = environment.speechSynthesis ?? globalThis.speechSynthesis;
  const Utterance = environment.SpeechSynthesisUtterance ?? globalThis.SpeechSynthesisUtterance;
  const later = environment.setTimeout ?? globalThis.setTimeout.bind(globalThis);
  const cancelLater = environment.clearTimeout ?? globalThis.clearTimeout.bind(globalThis);
  const now = environment.now ?? (() => globalThis.performance?.now?.() ?? Date.now());
  let context = null, filmGain = null, voiceGain = null, musicGain = null;
  let enabled = false, disposed = false, enableEpoch = 0;
  let film = { active: false, playing: false, ready: false, time: 0, rate: 1, sampledAt: now() }, filmFresh = true;
  let filmSource = null, filmAnchor = null, filmPending = false, filmEpoch = 0;
  let musicSource = null, musicAnchor = null, musicPending = false, musicEpoch = 0;
  let musicArmed = false, musicOffset = 0, musicDuration = 0;
  let voiceSource = null, utterance = null, voiceEpoch = 0, voiceTimer = null;
  let voiceBusy = false, currentKey = null, scope = null, lastError = '';
  let lastNarration = null;
  let queue = [];
  const seen = new Set(), buffers = new Map(), effects = new Map();
  const hidden = () => doc?.hidden === true || doc?.visibilityState === 'hidden';
  const audible = () => enabled && !disposed && !hidden() && context?.state === 'running';
  const currentFilmTime = () => Math.max(0, film.time + (film.playing ? Math.max(0, now() - film.sampledAt) / 1000 * film.rate : 0));

  function createContext() {
    if (context) return context;
    if (!AudioContext) throw new Error('audio-context-unavailable');
    context = new AudioContext();
    // The separated dialogue / action stem follows the video timeline.
    filmGain = context.createGain(); filmGain.gain.value = 1; filmGain.connect(context.destination);
    voiceGain = context.createGain(); voiceGain.gain.value = .9; voiceGain.connect(context.destination);
    musicGain = context.createGain(); musicGain.gain.value = 0; musicGain.connect(context.destination);
    return context;
  }
  function duck() {
    if (!context || !filmGain) return;
    filmGain.gain.cancelScheduledValues(context.currentTime);
    filmGain.gain.setTargetAtTime(voiceBusy ? .055 : 1, context.currentTime, .08);
    musicGain.gain.cancelScheduledValues(context.currentTime);
    // The full background stem has its own clock and remains audible when
    // the video is playing, held, or seeking. Only explicit narration ducks it.
    musicGain.gain.setTargetAtTime((LANDING_MUSIC.gain ?? 1) * (voiceBusy ? .55 : 1), context.currentTime, .08);
  }
  function disconnect(source) {
    if (!source) return;
    source.onended = null;
    try { source.stop(); } catch {}
    try { source.disconnect(); } catch {}
  }
  function stopFilmAudio() {
    filmEpoch++; filmPending = false;
    disconnect(filmSource); filmSource = filmAnchor = null;
  }
  function musicLoopBounds() {
    const end = Number.isFinite(LANDING_MUSIC.loopEnd) ? Math.max(0, Math.min(LANDING_MUSIC.loopEnd, musicDuration)) : musicDuration;
    const start = Number.isFinite(LANDING_MUSIC.loopStart) ? Math.max(0, Math.min(LANDING_MUSIC.loopStart, end)) : 0;
    return end > start ? { start, end } : { start: 0, end: musicDuration };
  }
  function musicPosition() {
    const elapsed = musicOffset + (musicAnchor ? Math.max(0, context.currentTime - musicAnchor.started) : 0);
    const { start, end } = musicLoopBounds();
    return end > start && elapsed >= end ? start + (elapsed - start) % (end - start) : elapsed;
  }
  function pauseMusic({ reset = false } = {}) {
    musicOffset = reset ? 0 : musicPosition();
    musicEpoch++; musicPending = false;
    disconnect(musicSource); musicSource = musicAnchor = null;
    if (reset) musicArmed = false;
  }
  function stopSpeech() {
    voiceEpoch++; queue = []; scope = null;
    if (voiceTimer !== null) cancelLater(voiceTimer);
    voiceTimer = null; disconnect(voiceSource); voiceSource = null;
    if (utterance) { utterance.onend = utterance.onerror = null; utterance = null; synthesis?.cancel?.(); }
    currentKey = null; voiceBusy = false; duck();
  }
  function stopEffects() {
    for (const [source, gain] of effects) { disconnect(source); gain.disconnect(); }
    effects.clear();
  }
  function stopAll() { stopFilmAudio(); pauseMusic(); stopSpeech(); stopEffects(); }

  function bufferFor(src) {
    if (buffers.has(src)) return buffers.get(src);
    const request = new Promise((resolve, reject) => {
      let settled = false;
      const controller = typeof AbortController === 'function' ? new AbortController() : null;
      const timer = later(() => {
        if (settled) return;
        settled = true; controller?.abort(); reject(new Error('audio-load-timeout'));
      }, 12000);
      Promise.resolve().then(() => {
        if (!fetchAudio) throw new Error('audio-fetch-unavailable');
        return fetchAudio(resolveAudioURL(src), controller ? { signal: controller.signal } : {});
      }).then(response => {
        if (!response.ok) throw new Error('audio-http-error');
        return response.arrayBuffer();
      }).then(bytes => context.decodeAudioData(bytes)).then(value => {
        if (settled) return;
        settled = true; cancelLater(timer); resolve(value);
      }, error => {
        if (settled) return;
        settled = true; cancelLater(timer); reject(error);
      });
    });
    // Cache failures too: frame-by-frame synchronization must not retry-spam.
    buffers.set(src, request); return request;
  }
  function syncFilmAudio() {
    if (!audible() || !film.active || !film.playing || !filmFresh) {
      if (filmSource || filmPending) stopFilmAudio();
      return;
    }
    if (filmSource) {
      const actual = filmAnchor.time + (context.currentTime - filmAnchor.started) * filmAnchor.rate;
      if (Math.abs(actual - currentFilmTime()) <= .25 && filmAnchor.rate === film.rate) return;
      stopFilmAudio();
    }
    if (filmPending) return;
    filmPending = true; const token = ++filmEpoch;
    bufferFor(LANDING_FILM_AUDIO.src).then(buffer => {
      if (token !== filmEpoch || !audible() || !film.active || !film.playing || !filmFresh) return;
      filmPending = false;
      const offset = currentFilmTime();
      if (offset >= buffer.duration - .01) return;
      const source = context.createBufferSource(); source.buffer = buffer; source.playbackRate.value = film.rate;
      source.connect(filmGain); filmSource = source;
      filmAnchor = { time: offset, started: context.currentTime, rate: film.rate };
      source.onended = () => { if (filmSource === source) { source.disconnect(); filmSource = filmAnchor = null; } };
      duck(); source.start(0, offset);
    }).catch(error => {
      if (token !== filmEpoch) return;
      filmPending = false; lastError = String(error?.message || 'film-audio-unavailable');
    });
  }
  function syncMusic() {
    if (!audible() || !film.active || !musicArmed) {
      if (musicSource || musicPending) pauseMusic();
      return;
    }
    // Unlike dialogue, the score has its own clock. Holds, seeking backwards,
    // and video rate changes must not recreate this full-length looping source.
    if (musicSource || musicPending) return;
    musicPending = true; const token = ++musicEpoch;
    bufferFor(LANDING_MUSIC.src).then(buffer => {
      if (token !== musicEpoch || !audible() || !film.active || !musicArmed) return;
      musicPending = false; musicDuration = buffer.duration;
      if (!(musicDuration > 0)) return;
      musicOffset = musicPosition();
      const source = context.createBufferSource(); source.buffer = buffer;
      const bounds = musicLoopBounds();
      source.loop = true; source.loopStart = bounds.start; source.loopEnd = bounds.end;
      source.playbackRate.value = 1; source.connect(musicGain); musicSource = source;
      musicAnchor = { started: context.currentTime };
      source.onended = () => {
        if (musicSource !== source) return;
        musicOffset = musicPosition();
        source.disconnect(); musicSource = musicAnchor = null;
        // A loop normally never ends. Recover an unexpected source end at its
        // independent position without replaying any film dialogue.
        syncMusic();
      };
      duck(); source.start(0, musicOffset);
    }).catch(error => {
      if (token !== musicEpoch) return;
      musicPending = false; lastError = String(error?.message || 'music-unavailable');
    });
  }
  function finishVoice(token) {
    if (token !== voiceEpoch) return;
    if (voiceTimer !== null) cancelLater(voiceTimer);
    voiceTimer = null;
    if (voiceSource) { voiceSource.onended = null; voiceSource.disconnect(); voiceSource = null; }
    if (utterance) { utterance.onend = utterance.onerror = null; utterance = null; }
    voiceBusy = false; currentKey = null; duck(); drainQueue();
  }
  function synthesize(job, token) {
    if (token !== voiceEpoch || !audible()) return;
    if (!job.allowDeviceVoice) {
      // A missing recording is silent, rather than unexpectedly changing the
      // character into the artificial system voice rejected in the landing.
      lastError = lastError || 'narration-recording-unavailable'; finishVoice(token); return;
    }
    if (!synthesis?.speak || !Utterance) { lastError = 'speech-synthesis-unavailable'; finishVoice(token); return; }
    const speech = new Utterance(job.text); utterance = speech;
    speech.lang = job.lang; speech.rate = .94; speech.pitch = 1.03; speech.volume = .9;
    const voices = synthesis.getVoices?.() || [];
    const room = isRoomNarration(job.scope);
    const matched = room ? findLocalLandingVoice(voices, job.lang) : null;
    const localFallback = room && voices.find(v => v.localService === true && v.lang.replace('_', '-').toLowerCase() === job.lang.toLowerCase());
    const chosen = matched || localFallback || voices.find(v => v.lang.replace('_', '-').toLowerCase() === job.lang.toLowerCase())
      || voices.find(v => v.lang.split(/[-_]/)[0] === job.lang.split('-')[0]);
    if (chosen) speech.voice = chosen;
    if (room) {
      speech.rate = ROOM_VOICE_PROFILE.browserRate;
      speech.pitch = ROOM_VOICE_PROFILE.browserPitch;
      speech.volume = ROOM_VOICE_PROFILE.browserVolume;
    }
    lastNarration = { source: matched ? 'device-matched' : 'device-fallback',
      requestedVoiceId: ROOM_VOICE_PROFILE.model,
      voiceId: matched ? ROOM_VOICE_PROFILE.model : chosen?.voiceURI || chosen?.name || null,
      matchesLandingVoice: Boolean(matched), exactProviderProsody: false };
    speech.onend = () => finishVoice(token);
    speech.onerror = () => { if (token === voiceEpoch) lastError = 'speech-synthesis-error'; finishVoice(token); };
    voiceTimer = later(() => {
      if (token !== voiceEpoch) return;
      speech.onend = speech.onerror = null; synthesis.cancel(); lastError = 'speech-synthesis-timeout'; finishVoice(token);
    }, Math.min(45000, Math.max(8000, job.text.length * 380 + 5000)));
    try { synthesis.speak(speech); } catch { lastError = 'speech-synthesis-error'; finishVoice(token); }
  }
  function drainQueue() {
    if (voiceBusy || !audible() || !queue.length) return;
    const job = queue.shift(), token = ++voiceEpoch;
    voiceBusy = true; currentKey = job.key; duck();
    const src = clipFor(job);
    if (!src) { synthesize(job, token); return; }
    bufferFor(src).then(buffer => {
      if (token !== voiceEpoch || !audible()) return;
      const source = context.createBufferSource(); source.buffer = buffer;
      source.connect(voiceGain); voiceSource = source;
      lastNarration = { source: 'local-clip', src, requestedVoiceId: ROOM_VOICE_PROFILE.model,
        voiceId: ROOM_VOICE_PROFILE.model, matchesLandingVoice: true, exactProviderProsody: true };
      source.onended = () => finishVoice(token);
      voiceTimer = later(() => {
        if (token !== voiceEpoch) return;
        disconnect(voiceSource); voiceSource = null; finishVoice(token);
      }, (buffer.duration + 1) * 1000);
      source.start(0);
    }).catch(error => {
      if (token !== voiceEpoch || !audible()) return;
      lastError = String(error?.message || 'voice-clip-unavailable'); synthesize(job, token);
    });
  }
  function speakSequence(messages, options = {}) {
    if (!enabled || disposed || hidden() || !Array.isArray(messages)) return false;
    const nextScope = options.scope ?? scope ?? 'dialogue';
    if (scope !== null && nextScope !== scope) stopSpeech();
    scope = nextScope;
    let accepted = false;
    for (const message of messages) {
      const text = String(message?.text || '').replace(/\s+/g, ' ').trim(), key = String(message?.key || '');
      if (!text || !key || /^\(.*\)$/.test(normalize(text)) || seen.has(key)) continue;
      seen.add(key); queue.push({ text, key, scope: String(nextScope),
        allowDeviceVoice: options.allowDeviceVoice ?? !String(nextScope).startsWith('landing:'),
        lang: audioLanguage(message.lang || options.lang || 'zh-CN') }); accepted = true;
    }
    drainQueue(); return accepted;
  }
  function syncFilm({ active = false, playing = false, ready = false, time = 0, rate = 1 } = {}) {
    if (disposed) return;
    const wasActive = film.active, wasPlaying = film.playing;
    film = { active: Boolean(active), playing: Boolean(playing), ready: Boolean(ready), time: Number.isFinite(time) ? Math.max(0, time) : 0,
      rate: Number.isFinite(rate) && rate > 0 ? rate : 1, sampledAt: now() };
    filmFresh = !hidden();
    if (wasActive && !film.active || !wasPlaying && film.playing) stopSpeech();
    if (!film.active) pauseMusic({ reset: true });
    else if ((film.playing || film.ready) && filmFresh) musicArmed = true;
    syncFilmAudio(); syncMusic(); duck();
  }
  async function setEnabled(value) {
    if (disposed) return false;
    if (!value) {
      enabled = false; enableEpoch++; stopAll();
      try { await context?.suspend?.(); } catch {}
      return enabled;
    }
    enabled = true; const token = ++enableEpoch;
    try {
      createContext();
      if (!hidden()) await context.resume();
      if (token !== enableEpoch || disposed) return enabled;
      if (!hidden() && context.state !== 'running') throw new Error('audio-resume-blocked');
      syncFilmAudio(); syncMusic(); drainQueue(); return enabled;
    } catch (error) {
      if (token === enableEpoch) { enabled = false; stopAll(); lastError = String(error?.message || 'audio-unavailable'); }
      return enabled;
    }
  }
  function cue(kind = 'reply') {
    if (!audible() || voiceBusy) return;
    const notes = kind === 'portal' ? [220, 330, 440] : kind === 'send' ? [392] : [523.25, 659.25];
    notes.forEach((frequency, index) => {
      const oscillator = context.createOscillator(), gain = context.createGain(), start = context.currentTime + index * .1;
      oscillator.type = 'sine'; oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.025, start + .018);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .34);
      oscillator.connect(gain); gain.connect(context.destination); effects.set(oscillator, gain);
      oscillator.onended = () => { effects.delete(oscillator); oscillator.disconnect(); gain.disconnect(); };
      oscillator.start(start); oscillator.stop(start + .36);
    });
  }
  function visibilityChanged() {
    if (disposed) return;
    if (hidden()) {
      enableEpoch++; filmFresh = false; stopAll();
      try { context?.suspend?.().catch?.(() => {}); } catch {}
    } else if (enabled && context) {
      const token = ++enableEpoch;
      try { Promise.resolve(context.resume()).then(() => { if (token === enableEpoch && enabled && !disposed) { syncFilmAudio(); syncMusic(); } }).catch(() => {}); } catch {}
    }
  }
  doc?.addEventListener?.('visibilitychange', visibilityChanged);
  return {
    setEnabled, syncFilm, cue, speakSequence, stopSpeech,
    speak(text, key, options = {}) { return speakSequence([{ text, key }], options); },
    resetSession() { stopSpeech(); pauseMusic({ reset: true }); seen.clear(); },
    get enabled() { return enabled; },
    getDiagnostics: () => ({ enabled, disposed, hidden: hidden(), contextState: context?.state || 'uninitialized',
      musicPlaying: Boolean(musicSource), musicPending, musicTime: musicArmed ? musicPosition() : null, musicArmed, musicEnded: false, musicLooping: Boolean(musicSource?.loop), musicLoop: musicLoopBounds(), musicGain: musicGain?.gain.value ?? 0,
      filmAudioPlaying: Boolean(filmSource), filmAudioPending: filmPending,
      filmAudioTime: filmAnchor ? filmAnchor.time + (context.currentTime - filmAnchor.started) * filmAnchor.rate : null,
      voicePlaying: voiceBusy, currentKey, queued: queue.length, seenKeys: seen.size, scope, film: { ...film }, lastError,
      lastNarration: lastNarration ? { ...lastNarration } : null }),
    dispose() {
      if (disposed) return;
      enabled = false; enableEpoch++; stopAll(); disposed = true;
      doc?.removeEventListener?.('visibilitychange', visibilityChanged);
      try { context?.close?.().catch?.(() => {}); } catch {}
      buffers.clear(); seen.clear();
    },
  };
}
