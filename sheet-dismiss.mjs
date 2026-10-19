// Only the panel handle/header begins dismissal; scrolling content never does.
export function isDismissSwipe(dx, dy) { return dy >= 56 && dy > Math.abs(dx) * 1.4; }
export function bindSheetDismiss(panel, onDismiss) {
  let start;
  const down = event => {
    if (event.button !== 0 || !event.target.closest('.sheet-handle,.sheet-title,.kn-date-handle,.kn-date-picker header') || event.target.closest('button,input,textarea,select')) return;
    start = {id: event.pointerId, x: event.clientX, y: event.clientY};
    panel.setPointerCapture?.(event.pointerId);
  };
  const up = event => {
    if (!start || event.pointerId !== start.id) return;
    const origin = start; start = null;
    if (panel.hasPointerCapture?.(event.pointerId)) panel.releasePointerCapture(event.pointerId);
    if (isDismissSwipe(event.clientX - origin.x, event.clientY - origin.y)) onDismiss();
  };
  const cancel = () => { start = null; };
  panel.addEventListener('pointerdown', down); panel.addEventListener('pointerup', up); panel.addEventListener('pointercancel', cancel);
  return () => { panel.removeEventListener('pointerdown', down); panel.removeEventListener('pointerup', up); panel.removeEventListener('pointercancel', cancel); };
}
