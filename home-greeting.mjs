const DISPLAY_MS = 5000;
const TAP_REPLIES = [
  ['嗯？我在。', '有什麼想告訴我？'],
  ['嘿，有點癢。', '要不要聊一會？'],
  ['陪你待一會。', '不說話也可以。'],
  ['我在聽。', '今天過得怎麼樣？'],
];

// Session-only dialogue: no repeating idle prompts and no persisted user data.
export function createHomeGreeting() {
  const greeted = new Set();
  let page, bubble, userId, speech, listeners;
  let entryTimer, hideTimer, replyIndex = 0, lastTapAt = 0;

  function clearTimers() {
    clearTimeout(entryTimer);
    clearTimeout(hideTimer);
  }

  function hide() {
    // Leave a focused/hovered invitation available until the user moves away.
    if (document.hidden || bubble?.matches(':hover, :focus-within')) return;
    speech = null;
    bubble?.classList.remove('is-visible');
    bubble?.setAttribute('aria-hidden', 'true');
    if (bubble) { bubble.tabIndex = -1; bubble.inert = true; }
  }

  function dismissAfter(duration) {
    clearTimeout(hideTimer);
    if (!speech || !bubble?.isConnected) return;
    speech.until = Date.now() + duration;
    hideTimer = setTimeout(hide, duration);
  }

  function paint() {
    if (!speech || !bubble?.isConnected) return;
    bubble.querySelectorAll('.greeting-copy > span').forEach((line, i) => {
      line.textContent = speech.lines[i] || '';
    });
    bubble.setAttribute('aria-label', `${speech.lines.join(' ')} 點這裡開始聊天`);
    bubble.removeAttribute('aria-hidden');
    bubble.inert = false;
    bubble.tabIndex = 0;
    bubble.classList.add('is-visible');
    dismissAfter(Math.max(800, speech.until - Date.now()));
  }

  function say(lines) {
    if (!page?.isConnected || !bubble) return;
    clearTimeout(entryTimer);
    greeted.add(userId);
    speech = { lines, until: Date.now() + DISPLAY_MS };
    paint();
  }

  function sync(nextPage, user) {
    const sameVisit = Boolean(page && nextPage && userId === user.id);
    clearTimers();
    listeners?.abort();
    if (!sameVisit) speech = null;
    page = nextPage;
    bubble = page?.querySelector('.greeting');
    userId = user.id;
    if (!bubble) return;

    listeners = new AbortController();
    const options = { signal: listeners.signal };
    const hold = () => clearTimeout(hideTimer);
    const release = () => {
      if (!document.hidden && !bubble.matches(':hover, :focus-within')) dismissAfter(1800);
    };
    bubble.addEventListener('pointerenter', hold, options);
    bubble.addEventListener('pointerleave', release, options);
    bubble.addEventListener('focusin', hold, options);
    bubble.addEventListener('focusout', release, options);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) hold();
      else dismissAfter(DISPLAY_MS);
    }, options);

    if (speech && speech.until > Date.now()) paint();
    else if (!greeted.has(userId)) {
      // Wait for the room transition before the companion greets the user.
      entryTimer = setTimeout(() => say([`嗨，${user.name}。`, '今天過得怎麼樣？']), 650);
    }
  }

  function respond() {
    const now = Date.now();
    if (now - lastTapAt < 900) return;
    lastTapAt = now;
    say(TAP_REPLIES[replyIndex++ % TAP_REPLIES.length]);
  }

  function reset() {
    clearTimers();
    listeners?.abort();
    greeted.clear();
    page = bubble = speech = null;
    replyIndex = lastTapAt = 0;
  }

  return { sync, respond, reset };
}
