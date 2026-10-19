// Use the visible Safari viewport, including keyboard changes, without turning
// pinch zoom into a layout resize. Values stay in CSS pixels.
export function visibleViewport(win) {
  const visual = win.visualViewport;
  const zoomed = visual && Math.abs((visual.scale || 1) - 1) > .05;
  const height = Math.max(1, visual && !zoomed ? visual.height : win.innerHeight);
  const top = visual && !zoomed ? Math.max(0, visual.offsetTop || 0) : 0;
  return {height, top, bottom: top + height, keyboard: !zoomed && win.innerHeight - height > 140};
}

export function sheetPlacement(rect, width, viewport) {
  const scale = rect.width / width || 1;
  const bottom = Math.min(rect.bottom, viewport.bottom);
  const top = Math.max(rect.top, viewport.top);
  return {left: rect.left, bottom: Math.max(0, viewport.layoutHeight - bottom), width,
    height: Math.max(1, bottom - top) * .92 / scale, scale};
}
