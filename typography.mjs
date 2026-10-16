// Public name is retained for canvas exporters; the product now uses bold system
// typography. No network font fetch or font readiness gate is needed.
export const HAND_FONT_FAMILY = '"PingFang TC", "PingFang SC", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif';
const SKIP = 'script,style,textarea,input,select,option,svg,[contenteditable],.klin-name,.share-card-brand-mark,[data-klin-font-skip]';

export function initTypography(root = globalThis.document) {
  if (!root?.querySelectorAll) return 0;
  const document = root.ownerDocument || root;
  const view = document.defaultView;
  const walker = document.createTreeWalker(root, view.NodeFilter.SHOW_TEXT);
  const nodes = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (/\bKlin\b/.test(node.nodeValue) && !node.parentElement?.closest(SKIP)) nodes.push(node);
  }
  for (const node of nodes) {
    const fragment = document.createDocumentFragment();
    const pieces = node.nodeValue.split(/(\bKlin\b)/);
    for (const text of pieces) {
      if (text === 'Klin') {
        const span = document.createElement('span');
        span.className = 'klin-name'; span.textContent = text; fragment.append(span);
      } else fragment.append(document.createTextNode(text));
    }
    node.replaceWith(fragment);
  }
  return nodes.length;
}

// Kept async for existing canvas export callers.
export async function loadTypography() { return true; }
