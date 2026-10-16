// Enhanced single selects keep the native control as the actual form value.
// Load form-controls.css before calling initFormControls(root). Without this
// module, the original select remains an ordinary, keyboard-accessible select.
const instances = new WeakMap();
let controlSequence = 0;

export function nextEnabledIndex(options, start, direction, { wrap = true } = {}) {
  if (!options.length) return -1;
  const step = direction < 0 ? -1 : 1;
  let index = start;
  for (let checked = 0; checked < options.length; checked++) {
    index += step;
    if (wrap) index = (index + options.length) % options.length;
    else if (index < 0 || index >= options.length) return -1;
    const option = options[index];
    if (!option.disabled && !option.hidden) return index;
  }
  return -1;
}

function icon(document, type) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add(type === 'check' ? 'klin-select-check' : 'klin-select-chevron');
  const path = document.createElementNS(svg.namespaceURI, 'path');
  path.setAttribute('d', type === 'check' ? 'M4.5 10.1 8 13.5 15.5 6' : 'm5.5 8 4.5 4.5L14.5 8');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.6');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  svg.append(path);
  return svg;
}

function snapshot(select) {
  return [...select.options].map(option => ({
    index: option.index,
    label: option.label || option.textContent || '',
    disabled: option.disabled || (option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.disabled),
    hidden: option.hidden || (option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.hidden),
    group: option.parentElement?.tagName === 'OPTGROUP' ? option.parentElement.label : '',
  }));
}

export function initFormControls(root = globalThis.document, { suppressAutofill = true } = {}) {
  if (!root?.querySelectorAll) return () => {};
  instances.get(root)?.();
  const document = root.ownerDocument || root;
  const view = document.defaultView;
  const controller = new view.AbortController();
  const signal = controller.signal;
  const records = [];
  const attributes = [];
  let opened = null;
  let destroyed = false;
  const all = selector => [...(root.matches?.(selector) ? [root] : []), ...root.querySelectorAll(selector)];
  const saveAttribute = (element, name, value) => {
    attributes.push({ element, name, value: element.getAttribute(name) });
    if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
  };
  if (suppressAutofill) {
    // This asks the browser to avoid saved-value suggestions. Browsers may
    // still show their own autofill, password-manager or validation UI.
    for (const element of all('form,input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]),textarea,select')) {
      saveAttribute(element, 'autocomplete', 'off');
    }
  }

  function close({ focus = false } = {}) {
    if (!opened) return;
    const record = opened;
    opened = null;
    record.button.setAttribute('aria-expanded', 'false');
    record.button.removeAttribute('aria-controls');
    record.button.removeAttribute('aria-activedescendant');
    record.wrapper.classList.remove('is-open');
    record.layer?.remove();
    record.layer = record.list = null;
    if (focus && record.button.isConnected) record.button.focus({ preventScroll: true });
  }

  function refresh(record) {
    const { select, button, value } = record;
    record.options = snapshot(select);
    value.textContent = select.selectedOptions[0]?.label || select.selectedOptions[0]?.textContent || select.getAttribute('data-placeholder') || '請選擇';
    button.disabled = select.matches(':disabled') || !record.options.some(option => !option.disabled && !option.hidden);
    button.setAttribute('aria-required', String(select.required));
    if (select.getAttribute('aria-invalid') === 'true') button.setAttribute('aria-invalid', 'true');
    else button.removeAttribute('aria-invalid');
    if (select.getAttribute('aria-describedby')) button.setAttribute('aria-describedby', select.getAttribute('aria-describedby'));
    else button.removeAttribute('aria-describedby');
    if (opened === record) {
      if (button.disabled || !select.isConnected) close();
      else { populate(record); position(record); }
    }
  }

  function setActive(record, index, { scroll = true } = {}) {
    if (index < 0 || record.options[index]?.disabled || record.options[index]?.hidden) return;
    record.active = index;
    for (const option of record.list.querySelectorAll('[role="option"]')) option.classList.toggle('is-active', Number(option.dataset.optionIndex) === index);
    const option = record.list.querySelector(`[data-option-index="${index}"]`);
    if (option) {
      record.button.setAttribute('aria-activedescendant', option.id);
      if (scroll) {
        const top = option.offsetTop, bottom = top + option.offsetHeight;
        if (top < record.list.scrollTop) record.list.scrollTop = top;
        else if (bottom > record.list.scrollTop + record.list.clientHeight) record.list.scrollTop = bottom - record.list.clientHeight;
      }
    }
  }

  function populate(record) {
    record.list.replaceChildren();
    let previousGroup = '';
    for (const option of record.options) {
      if (option.hidden) continue;
      if (option.group && option.group !== previousGroup) {
        const heading = document.createElement('div');
        heading.className = 'klin-select-group';
        heading.setAttribute('role', 'presentation');
        heading.textContent = option.group;
        record.list.append(heading);
      }
      previousGroup = option.group;
      const item = document.createElement('div');
      item.className = 'klin-select-option';
      item.id = `${record.listId}-option-${option.index}`;
      item.dataset.optionIndex = String(option.index);
      item.setAttribute('role', 'option');
      item.setAttribute('aria-selected', String(option.index === record.select.selectedIndex));
      if (option.disabled) item.setAttribute('aria-disabled', 'true');
      const label = document.createElement('span');
      label.textContent = option.label;
      item.append(label, icon(document, 'check'));
      record.list.append(item);
    }
    if (!record.options[record.active] || record.options[record.active].disabled || record.options[record.active].hidden) {
      record.active = record.select.selectedIndex;
      if (!record.options[record.active] || record.options[record.active].disabled || record.options[record.active].hidden) record.active = nextEnabledIndex(record.options, -1, 1, { wrap: false });
    }
    setActive(record, record.active, { scroll: false });
  }

  function position(record) {
    if (!record.layer || !record.select.isConnected) { close(); return; }
    const host = record.host;
    const button = record.button.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const isBody = host === document.body;
    const scaleX = isBody ? 1 : (host.clientWidth || hostRect.width) / hostRect.width;
    const scaleY = isBody ? 1 : (host.clientHeight || hostRect.height) / hostRect.height;
    const width = isBody ? view.innerWidth : host.clientWidth;
    const height = isBody ? view.innerHeight : host.clientHeight;
    const x = isBody ? button.left : (button.left - hostRect.left) * scaleX + host.scrollLeft;
    const y = isBody ? button.top : (button.top - hostRect.top) * scaleY + host.scrollTop;
    const buttonWidth = button.width * scaleX;
    const buttonHeight = button.height * scaleY;
    const padding = 10, gap = 6;
    const below = height - y - buttonHeight - padding - gap;
    const above = y - padding - gap;
    const showAbove = below < 180 && above > below;
    const available = Math.max(80, showAbove ? above : below);
    const maxHeight = Math.min(290, available);
    record.list.style.maxHeight = `${maxHeight}px`;
    record.list.style.width = `${Math.min(Math.max(180, buttonWidth), width - padding * 2)}px`;
    record.list.style.left = `${Math.max(padding, Math.min(x, width - record.list.offsetWidth - padding))}px`;
    record.list.style.top = `${showAbove ? Math.max(padding, y - gap - record.list.offsetHeight) : y + buttonHeight + gap}px`;
    record.list.dataset.placement = showAbove ? 'top' : 'bottom';
  }

  function open(record) {
    if (record.button.disabled) return;
    if (opened === record) { close({ focus: true }); return; }
    close();
    record.options = snapshot(record.select);
    record.active = record.select.selectedIndex;
    record.host = record.select.closest('dialog[open]') || record.select.closest('.phone') || document.body;
    const layer = document.createElement('div');
    layer.className = 'klin-select-layer';
    if (record.host === document.body) layer.classList.add('is-viewport');
    const list = document.createElement('div');
    list.id = record.listId;
    list.className = 'klin-select-popover';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-label', record.label);
    list.setAttribute('aria-orientation', 'vertical');
    layer.append(list);
    record.host.append(layer);
    record.layer = layer; record.list = list;
    opened = record;
    record.wrapper.classList.add('is-open');
    record.button.setAttribute('aria-expanded', 'true');
    record.button.setAttribute('aria-controls', record.listId);
    populate(record); position(record);
    setActive(record, record.active);
    list.addEventListener('pointerdown', event => { event.preventDefault(); }, { signal });
    list.addEventListener('click', event => {
      const option = event.target.closest('[data-option-index]');
      if (option) commit(record, Number(option.dataset.optionIndex));
    }, { signal });
    list.addEventListener('pointermove', event => {
      const option = event.target.closest('[data-option-index]');
      if (option) setActive(record, Number(option.dataset.optionIndex), { scroll: false });
    }, { signal });
  }

  function commit(record, index, { focus = true } = {}) {
    const option = record.options[index];
    if (!option || option.disabled || option.hidden) return;
    const changed = record.select.selectedIndex !== index;
    record.select.selectedIndex = index;
    record.select.removeAttribute('aria-invalid');
    close({ focus });
    refresh(record);
    if (changed) {
      record.select.dispatchEvent(new view.Event('input', { bubbles: true }));
      record.select.dispatchEvent(new view.Event('change', { bubbles: true }));
    }
  }

  function keydown(record, event) {
    const isOpen = opened === record;
    if (['ArrowDown', 'ArrowUp', 'Home', 'End', 'PageDown', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      if (event.altKey && event.key === 'ArrowUp') { close({ focus: true }); return; }
      if (!isOpen) { open(record); if (['ArrowDown', 'ArrowUp'].includes(event.key)) return; }
      const direction = ['ArrowUp', 'PageUp', 'End'].includes(event.key) ? -1 : 1;
      let index = record.active;
      if (event.key === 'Home') index = nextEnabledIndex(record.options, -1, 1, { wrap: false });
      else if (event.key === 'End') index = nextEnabledIndex(record.options, record.options.length, -1, { wrap: false });
      else for (let step = 0; step < (event.key.startsWith('Page') ? 10 : 1); step++) {
        const next = nextEnabledIndex(record.options, index, direction, { wrap: false });
        if (next >= 0) index = next;
      }
      setActive(record, index); return;
    }
    if (event.key === 'Escape' && isOpen) { event.preventDefault(); event.stopPropagation(); close({ focus: true }); return; }
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); if (isOpen) commit(record, record.active); else open(record); return; }
    if (event.key === 'Tab' && isOpen) { commit(record, record.active, { focus: false }); return; }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (!isOpen) open(record);
      const now = Date.now();
      const repeated = now - record.queryAt < 600 && record.query && [...record.query].every(character => character === event.key);
      record.query = now - record.queryAt < 600 && !repeated ? record.query + event.key : event.key;
      record.queryAt = now;
      for (let step = 0; step < record.options.length; step++) {
        const index = ((repeated ? record.active + 1 : 0) + step) % record.options.length;
        const option = record.options[index];
        if (!option.disabled && !option.hidden && option.label.toLocaleLowerCase().startsWith(record.query.toLocaleLowerCase())) { setActive(record, option.index); break; }
      }
    }
  }

  for (const select of all('select')) {
    if (select.multiple || select.size > 1 || select.closest('.klin-select,[inert],[aria-hidden="true"]') || select.dataset.nativeSelect === 'true') continue;
    const wrapper = document.createElement('div');
    wrapper.className = 'klin-select';
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'klin-select-trigger';
    const value = document.createElement('span');
    value.className = 'klin-select-value';
    const id = `klin-select-${++controlSequence}`;
    value.id = `${id}-value`;
    const labels = [...select.labels || []];
    const labelIds = labels.map((label, index) => {
      if (!label.id) { label.id = `${id}-label-${index}`; }
      return label.id;
    });
    const label = select.getAttribute('aria-label') || labels.map(label => label.textContent.trim()).join(' ') || '選擇選項';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    if (select.getAttribute('aria-label')) button.setAttribute('aria-label', label);
    else if (labelIds.length) button.setAttribute('aria-labelledby', labelIds.join(' '));
    else button.setAttribute('aria-label', label);
    button.append(value, icon(document, 'chevron'));
    select.before(wrapper); wrapper.append(select, button);
    const record = { select, button, value, wrapper, listId: `${id}-list`, label, options: [], active: -1, query: '', queryAt: 0, observer: null };
    saveAttribute(select, 'tabindex', '-1'); saveAttribute(select, 'aria-hidden', 'true');
    select.classList.add('klin-native-select');
    records.push(record); refresh(record);
    button.addEventListener('click', () => open(record), { signal });
    button.addEventListener('keydown', event => keydown(record, event), { signal });
    button.addEventListener('blur', () => { if (opened === record) close(); }, { signal });
    select.addEventListener('change', () => refresh(record), { signal });
    select.addEventListener('input', () => refresh(record), { signal });
    select.addEventListener('focus', () => button.focus({ preventScroll: true }), { signal });
    select.addEventListener('invalid', event => { event.preventDefault(); button.setAttribute('aria-invalid', 'true'); button.focus({ preventScroll: true }); open(record); }, { signal });
    for (const label of labels) label.addEventListener('click', event => {
      if (wrapper.contains(event.target)) return;
      event.preventDefault(); button.focus({ preventScroll: true });
    }, { signal });
    record.observer = new view.MutationObserver(() => refresh(record));
    record.observer.observe(select, { attributes: true, childList: true, subtree: true, characterData: true });
    select.form?.addEventListener('reset', () => queueMicrotask(() => refresh(record)), { signal });
  }

  document.addEventListener('pointerdown', event => {
    if (opened && !opened.wrapper.contains(event.target) && !opened.layer?.contains(event.target)) close();
  }, { capture: true, signal });
  document.addEventListener('scroll', event => {
    if (opened && event.target !== opened.list && !opened.list?.contains(event.target)) close();
  }, { capture: true, passive: true, signal });
  view.addEventListener('resize', () => close(), { signal });
  view.visualViewport?.addEventListener('resize', () => close(), { signal });
  const rootObserver = new view.MutationObserver(() => { if (opened && !opened.select.isConnected) close(); });
  rootObserver.observe(root === document ? document.documentElement : root, { childList: true, subtree: true });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true; close(); controller.abort(); rootObserver.disconnect();
    for (const record of records) {
      record.observer.disconnect(); record.select.classList.remove('klin-native-select');
      if (record.wrapper.parentNode) { record.wrapper.before(record.select); record.wrapper.remove(); }
    }
    for (const { element, name, value } of attributes.reverse()) {
      if (value === null) element.removeAttribute(name); else element.setAttribute(name, value);
    }
    if (instances.get(root) === destroy) instances.delete(root);
  };
  instances.set(root, destroy);
  return destroy;
}
