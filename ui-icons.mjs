/** One quiet, pen-drawn family for navigation and composer controls.
 * Asymmetric curves are part of the drawing, never an animation.
 * Every glyph shares a 24px grid, round ends and the same visible ink weight.
 */
const drawings = Object.freeze({
  visit: '<path d="M5.8 19.4c-.2-3.9-.1-8.2.1-12.3.1-2.5 2.8-3.9 6.1-3.8 3.4-.1 5.5 1.1 5.6 3.8.2 3.8.1 7.7.1 11.3"/><path d="M6.3 6.1c2.7.3 5.2 1.1 7.5 1.9.2 4.3.1 8.4.2 12.6-2.7-.5-5.2-1.2-7.8-2.1"/><path d="m19.6 4.7 1.5-1.6m-1.2 5.1 2-.6m-10.3 5.1.1.2"/>',
  profile: '<path d="M5.1 5.9c4.5-.4 9.3-.5 13.8-.7 2-.1 2.8.9 2.9 2.6.2 3.2.3 6.5.2 9.5 0 1.8-.9 2.6-2.8 2.7-4.7.2-9.5.6-14 .4-1.8 0-2.7-1-2.8-2.8-.2-3-.3-6.1-.2-9 .1-1.5 1-2.5 2.9-2.7Z"/><path d="M7.4 8.7c1.5-.1 2.4.8 2.4 2.1.1 1.4-.7 2.2-2 2.3-1.4.1-2.5-.7-2.5-2.1s.8-2.2 2.1-2.3Zm-3.2 8.1c.5-2.9 6.2-3.4 6.8-.3m3-6.5c1.6-.2 3.1-.2 4.8-.2m-4.4 4.8c1.3-.1 2.5-.1 3.8-.1"/>',
  memory: '<path d="M11.8 5.5C10 2 5.9 3 5.5 6.7 2 6.4.9 10.5 3.1 13.1c-2 2.7.2 6 3.1 5.9 1 3.5 5.4 2.7 5.5-.6.1-3.7.3-8.7.1-12.9Zm.1.6c1.3-3.8 5.6-3.6 6.6.1 3.6.5 4 4.5 2.3 6.9 2.4 2.9.2 6.5-3.2 6.2-.7 3-4.9 3.1-5.8-.8"/><path d="M6.7 8.3c2.6.5 3.4 2.5 2.1 4.3m-3.9 3c2-1.2 3.7-.1 3.7 1.5m9.3-8.3c-2.4-.4-3.6 1.3-3 3.2m4 3.4c-2.1-1.4-4.3-.3-4.2 1.8"/>',
  chat: '<path d="M21.4 11.3c.3 5.3-4.1 8-9.2 7.7L6.5 22l.3-5.1C.2 13 3.4 3.9 11.2 3.5c6.2-.3 9.9 2.4 10.2 7.8Z"/><path d="m7.7 11.5.1.1m4.4-.2.1.1m4.3-.1.1.1"/>',
  microphone: '<path d="M11.7 2.7c1.7-.2 3 .9 3.1 2.8.2 2.4.2 4.7 0 7.1-.1 1.7-1.1 2.9-2.8 2.9-1.7.1-2.9-1.1-2.9-2.8-.2-2.5-.2-4.7-.1-7.1.1-1.6 1-2.8 2.7-2.9Z"/><path d="M5.8 11.4c-.2 4 1.8 7 6.2 7.1 4.3.1 6.4-2.7 6.2-6.9m-6.3 7c.1 1.1.2 2.2.1 3.2m-3.3.3c2.1-.2 4.4-.2 6.6 0"/>',
  'volume-body': '<path d="M8.2 8.1c1.7-1.3 3.2-3.2 4.7-4.1.6-.4 1-.2 1 .7.2 4.7.3 9.5.1 14.2 0 .8-.5 1.1-1.1.6-1.6-1.1-3.1-2.9-4.7-4.2-1.4.1-2.8.2-4.1 0-.7-.1-1-.5-1-1.2l-.2-4.7c0-.8.4-1.2 1.1-1.2 1.3-.2 2.8-.1 4.2-.1Z"/>',
  'volume-wave': '<path d="M17.4 8.5c1.9 1.9 2.1 4.3.4 6.4m2.4-9c3.4 3.1 3.9 8.5.9 12"/>',
  'volume-cross': '<path d="M17.9 9.4c1.5 1.6 2.8 3.1 4 4.9m.1-4.9c-1.3 1.7-2.8 3.3-4.1 4.8"/>',
  send: '<path d="M11.7 20c.2-4.7.5-9.2.3-14.3m-6 5.7c2.1-1.9 4-4 6-6.1 1.9 2.1 3.7 4.4 5.9 6.2"/>',
  back: '<path d="M14.7 4.9c-2.2 2.3-4.3 4.7-6.6 7 2.1 2.5 4.5 4.8 6.9 7.1"/>',
  close: '<path d="M6.1 6.4c3.8 3.5 7.7 7.2 11.6 11.5M17.8 6.1c-3.6 3.9-7.4 7.7-11.5 11.7"/>',
  stop: '<path d="M6.7 6c3.5-.3 7.4-.3 10.9 0 .4 3.8.4 7.6.1 11.4-3.7.4-7.4.5-11.1.2-.3-3.9-.3-7.8.1-11.6Z"/>',
  more: '<path d="m5.1 12.1.1.1m6.6-.3.1.1m6.7.1.1.1"/>',
  calendar: '<path d="M6.2 5.7c3.8-.2 8-.3 11.9-.1 1.6.1 2.2 1 2.3 2.6.2 3.2.1 6.6-.1 9.8-.1 1.7-1 2.5-2.5 2.6-3.9.2-7.4.2-11.2 0-1.7-.1-2.5-1-2.5-2.7-.2-3.3-.2-6.5-.1-9.6.1-1.5.7-2.5 2.2-2.6Zm1.7-2.8c-.1 1.5-.1 3.2.1 4.7m8-4.8c.2 1.6.3 3.2.2 4.8M4.3 10.5c5.4.2 10.5 0 15.9-.1"/>',
  time: '<path d="M11.6 3.1c5-.3 9.1 3.4 9.3 8.5.2 5.2-3.5 9.1-8.5 9.3-5.1.2-9.4-3.5-9.5-8.7-.2-5.1 3.7-8.9 8.7-9.1Z"/><path d="M11.8 7c-.2 1.8-.1 3.5-.1 5.2 1.2.7 2.4 1.4 3.7 2"/>',
  search: '<path d="M10.2 3.8c3.8-.2 6.7 2.7 6.8 6.4.1 3.9-2.7 6.9-6.6 7-3.7.1-6.7-2.7-6.8-6.6-.1-3.7 2.8-6.6 6.6-6.8Zm5.1 12.1c1.7 1.8 3.5 3.4 5.3 5"/>',
});

export function uiIcon(name,{className='',attributes=''}={}) {
  const drawing = name==='volume'||name==='volume-muted'
    ? drawings['volume-body']+drawings[name==='volume-muted'?'volume-cross':'volume-wave']
    : drawings[name];
  if(!drawing)return '';
  return `<svg xmlns="http://www.w3.org/2000/svg" class="kn-ui-icon hand-drawn-icon ${className}" data-kn-icon="${name}" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false" ${attributes}>${drawing}</svg>`;
}
export function navIcon(name,selected=false){return uiIcon(name,{className:`nav-icon${selected?' nav-icon-active':''}`});}
export const backArrow=uiIcon('back',{className:'action-arrow back-chevron'});
export const sendArrow=uiIcon('send',{className:'action-arrow'});
export function volumeIcon(muted=false){return uiIcon(muted?'volume-muted':'volume',{className:'nav-icon volume-icon',attributes:`data-speaker-state="${muted?'muted':'sound'}"`});}
