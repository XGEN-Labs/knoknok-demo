export const visitTopics = [
  { id: 'art', label: '看展', topic: '一起看展，聊聊最近喜歡的作品', intro: '想認識喜歡看展的朋友，可以先聊聊最近喜歡的作品。' },
  { id: 'walk', label: '散步', topic: '找個喜歡散步的朋友，分享城市裡的小發現', intro: '喜歡慢慢散步，留意路上的小風景。想先聊聊彼此喜歡的地方。' },
  { id: 'chat', label: '聊聊天', topic: '輕鬆聊聊天，分享最近的日常', intro: '想認識一位可以輕鬆聊天的朋友，從最近的小事開始。' },
];

export function visitStage({ companion, action, label, phase = 'idle' }) {
  return `<div class="visit-stage is-${phase}">
    <span class="visit-path" aria-hidden="true"></span>
    <button type="button" class="visit-door" data-action="${action}" aria-label="${label}">
      <span class="visit-door-frame"><span class="visit-door-leaf"><span class="visit-door-window" aria-hidden="true">${phase==='found'?'✦':'···'}</span><span class="visit-door-knob" aria-hidden="true"></span></span></span>
      <span class="visit-door-sign">${phase === 'found' ? '有人應門了' : phase === 'seeking' ? '叩叩，等你回應' : '輕敲一下'}</span>
    </button>
    <div class="visit-companion">${companion}</div>
    <span class="visit-knock" aria-hidden="true">叩 叩</span>
  </div>`;
}
