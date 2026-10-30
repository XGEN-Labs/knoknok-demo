import { BIRTH_TIME_OPTIONS } from './conversation-onboarding.mjs?v=20261031-product-sync';

const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const validClock = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
const minutes = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
export const BIRTH_TIME_WHEEL_OPTIONS = Object.freeze([
  ...BIRTH_TIME_OPTIONS.map(option => Object.freeze({ ...option, label: option.label.replace(/时/g, '時') })),
  Object.freeze({ label: '不知道', range: '', value: null }),
]);
const UNKNOWN_TIME_INDEX = BIRTH_TIME_WHEEL_OPTIONS.length - 1;

/** Preserve a valid saved clock, including exact minutes, until the wheel is changed. */
export function birthTimeWheelSelection(value) {
  if (!validClock(value)) return { index: UNKNOWN_TIME_INDEX, value: null };
  const clock = minutes(value);
  const index = BIRTH_TIME_WHEEL_OPTIONS.findIndex(option => {
    if (option.value === null) return false;
    const range = option.range.match(/(\d{2}:\d{2})\D+(\d{2}:\d{2})/);
    if (!range) return option.value === value;
    const start = minutes(range[1]), end = minutes(range[2]);
    return start <= end ? clock >= start && clock <= end : clock >= start || clock <= end;
  });
  return { index: index < 0 ? UNKNOWN_TIME_INDEX : index, value: index < 0 ? null : value };
}

export function birthTimeWheelKeyIndex(key, index, length = BIRTH_TIME_WHEEL_OPTIONS.length) {
  const last = Math.max(0, length - 1), current = Math.max(0, Math.min(last, index));
  if (key === 'Home') return 0;
  if (key === 'End') return last;
  const delta = { ArrowUp: -1, ArrowDown: 1, PageUp: -3, PageDown: 3 }[key];
  return delta === undefined ? null : Math.max(0, Math.min(last, current + delta));
}

/** A draft selection. Scrolling never submits the surrounding form. */
export function birthTimePickerMarkup({ value = null, id = 'birth-time-picker', name = '', confirmLabel = '確定', showConfirm = true } = {}) {
  const selection = birthTimeWheelSelection(value), option = BIRTH_TIME_WHEEL_OPTIONS[selection.index];
  return `<section class="kn-birth-time-picker kn-glass-control" data-birth-time-picker id="${escapeHTML(id)}">
    <div class="kn-birth-time-track">
      <div class="kn-birth-time-selection" aria-hidden="true"></div>
      <div class="kn-birth-time-wheel" data-birth-time-wheel role="spinbutton" tabindex="0" aria-label="出生時辰" aria-valuemin="0" aria-valuemax="${BIRTH_TIME_WHEEL_OPTIONS.length - 1}" aria-valuenow="${selection.index}" aria-valuetext="${escapeHTML(`${option.label} ${option.range}`.trim())}">
        ${BIRTH_TIME_WHEEL_OPTIONS.map((item, index) => `<div class="kn-birth-time-option${index === selection.index ? ' is-selected' : ''}" data-birth-time-index="${index}" aria-hidden="true"><span>${escapeHTML(item.label)}</span>${item.range ? `<small>${escapeHTML(item.range)}</small>` : ''}</div>`).join('')}
      </div>
    </div>
    <input type="hidden" data-birth-time-value${name ? ` name="${escapeHTML(name)}"` : ''} value="${escapeHTML(selection.value)}">
    ${showConfirm ? `<button type="button" class="kn-birth-time-confirm kn-glass-control" data-birth-time-confirm>${escapeHTML(confirmLabel)}</button>` : ''}
  </section>`;
}

/** Mount one picker; return destroy() for route replacement and value for a form save. */
export function mountBirthTimePicker(root, { onChange = () => {}, onConfirm = () => {} } = {}) {
  const element = root?.matches?.('[data-birth-time-picker]') ? root : root?.querySelector?.('[data-birth-time-picker]');
  if (!element) return null;
  const wheel = element.querySelector('[data-birth-time-wheel]');
  const input = element.querySelector('[data-birth-time-value]');
  const confirm = element.querySelector('[data-birth-time-confirm]');
  const rows = [...element.querySelectorAll('[data-birth-time-index]')];
  const win = element.ownerDocument.defaultView;
  let { index, value } = birthTimeWheelSelection(input.value);
  let disposed = false, settleTimer = 0, positionFrame = 0, scrollFrame = 0, drag = null, suppressClick = false;
  const measurable = () => wheel.clientHeight > 0 && rows[0]?.offsetHeight > 0;
  const rowHeight = () => rows[0]?.offsetHeight || 48;
  const pointerScale = () => rowHeight() / (rows[0]?.getBoundingClientRect().height || rowHeight());
  const closestIndex = () => Math.max(0, Math.min(rows.length - 1, Math.round(wheel.scrollTop / rowHeight())));
  const paint = () => {
    const option = BIRTH_TIME_WHEEL_OPTIONS[index];
    rows.forEach((row, i) => row.classList.toggle('is-selected', i === index));
    wheel.setAttribute('aria-valuenow', String(index));
    wheel.setAttribute('aria-valuetext', `${option.label} ${option.range}${value && value !== option.value ? `，目前紀錄 ${value}` : ''}`.trim());
    input.value = value ?? '';
    element.dataset.value = value ?? '';
  };
  const choose = (nextIndex, explicit = false) => {
    const next = Math.max(0, Math.min(rows.length - 1, nextIndex));
    if (next === index && !explicit) return;
    const previous = value;
    index = next;
    value = BIRTH_TIME_WHEEL_OPTIONS[index].value;
    paint();
    if (previous !== value && !disposed) onChange(value);
  };
  const position = (smooth = false) => {
    if (!measurable()) return;
    const top = index * rowHeight();
    const reduced = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (smooth && !reduced && wheel.scrollTo) wheel.scrollTo({ top, behavior: 'smooth' });
    else wheel.scrollTop = top;
  };
  const settle = () => {
    win.clearTimeout(settleTimer);
    settleTimer = 0;
    if (disposed || drag || !measurable()) return;
    choose(closestIndex());
    if (Math.abs(wheel.scrollTop - index * rowHeight()) > .5) position(true);
  };
  const onScroll = () => {
    if (disposed || !measurable()) return;
    if (!scrollFrame) scrollFrame = win.requestAnimationFrame(() => {
      scrollFrame = 0;
      if (!disposed && measurable()) choose(closestIndex());
    });
    win.clearTimeout(settleTimer);
    settleTimer = win.setTimeout(settle, 160);
  };
  const commit = () => {
    if (disposed || !measurable()) return;
    win.clearTimeout(settleTimer);
    choose(closestIndex());
    position();
    onConfirm(value);
  };
  const onKey = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      // In an editor the surrounding save action owns submission.
      if (confirm) commit();
      return;
    }
    const next = birthTimeWheelKeyIndex(event.key, index, rows.length);
    if (next === null) return;
    event.preventDefault();
    win.clearTimeout(settleTimer);
    choose(next, true);
    position();
  };
  const onClick = event => {
    if (suppressClick) { suppressClick = false; return; }
    const row = event.target.closest?.('[data-birth-time-index]');
    if (!row || !wheel.contains(row)) return;
    choose(Number(row.dataset.birthTimeIndex), true);
    position(true);
    wheel.focus({ preventScroll: true });
  };
  const onPointerDown = event => {
    suppressClick = false;
    if (event.pointerType === 'touch' || event.button !== 0) return;
    drag = { id: event.pointerId, y: event.clientY, top: wheel.scrollTop, moved: false };
    wheel.setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const delta = event.clientY - drag.y;
    if (Math.abs(delta) > 4) drag.moved = true;
    if (!drag.moved) return;
    event.preventDefault();
    wheel.style.scrollSnapType = 'none';
    wheel.scrollTop = drag.top - delta * pointerScale();
  };
  const endDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    const moved = drag.moved;
    suppressClick = true;
    drag = null;
    wheel.style.scrollSnapType = '';
    if (wheel.hasPointerCapture?.(event.pointerId)) wheel.releasePointerCapture(event.pointerId);
    if (moved) settle();
    else {
      const pointerY = (event.clientY - wheel.getBoundingClientRect().top) * pointerScale();
      const clickedIndex = Math.floor((wheel.scrollTop + pointerY - rowHeight()) / rowHeight());
      choose(clickedIndex, true);
      position(true);
      wheel.focus({ preventScroll: true });
    }
  };
  const cancelDrag = event => {
    if (!drag || event.pointerId !== drag.id) return;
    drag.moved = true;
    endDrag(event);
    suppressClick = false;
  };
  const resize = () => { if (!disposed && !drag) position(); };
  const listeners = [
    ['scroll', onScroll, { passive: true }], ['scrollend', settle], ['keydown', onKey],
    ['click', onClick], ['pointerdown', onPointerDown], ['pointermove', onPointerMove],
    ['pointerup', endDrag], ['pointercancel', cancelDrag],
  ];
  listeners.forEach(([name, handler, options]) => wheel.addEventListener(name, handler, options));
  confirm?.addEventListener('click', commit);
  win.addEventListener('resize', resize);
  const observer = win.ResizeObserver ? new win.ResizeObserver(resize) : null;
  observer?.observe(wheel);
  paint();
  position();
  positionFrame = win.requestAnimationFrame(() => { positionFrame = 0; if (!disposed) position(); });
  return {
    get value() { return value; },
    setValue(nextValue) {
      if (disposed) return;
      ({ index, value } = birthTimeWheelSelection(nextValue));
      win.clearTimeout(settleTimer);
      paint();
      position();
    },
    destroy() {
      if (disposed) return;
      disposed = true;
      win.clearTimeout(settleTimer);
      win.cancelAnimationFrame(positionFrame);
      win.cancelAnimationFrame(scrollFrame);
      listeners.forEach(([name, handler, options]) => wheel.removeEventListener(name, handler, options));
      confirm?.removeEventListener('click', commit);
      win.removeEventListener('resize', resize);
      observer?.disconnect();
      if (drag && wheel.hasPointerCapture?.(drag.id)) wheel.releasePointerCapture(drag.id);
      drag = null;
      wheel.style.scrollSnapType = '';
    },
  };
}
