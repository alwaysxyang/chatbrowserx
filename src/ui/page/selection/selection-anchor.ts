export type BubblePlacement = 'above' | 'below';

export interface BubbleAnchor {
  left: number;
  top: number;
  placement: BubblePlacement;
}

export interface PointerPoint {
  x: number;
  y: number;
}

export interface SelectionSnapshot {
  text: string;
  rect: DOMRect;
}

interface ViewportSize {
  viewportWidth: number;
  viewportHeight: number;
}

const bubbleViewportMargin = 16;
const bubbleViewportGap = 10;
const maxBubbleWidth = 420;
const maxEstimatedPanelHeight = 370;

/**
 * Clamps a number between a minimum and maximum boundary.
 *
 * @param value - Value to clamp.
 * @param min - Lower boundary.
 * @param max - Upper boundary.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Calculates the straight-line distance between two viewport pointer points.
 *
 * @param start - The initial pointer position.
 * @param end - The final pointer position.
 * @returns The distance in CSS pixels.
 */
export function getPointerDistance(start: PointerPoint, end: PointerPoint): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

/**
 * Checks whether a node belongs to ChatBrowserX's ShadowRoot.
 *
 * @param node - The node to inspect.
 * @returns True when the node is inside ChatBrowserX UI.
 */
export function isInsideChatBrowserX(node: Node | null): boolean {
  const host = document.getElementById('chatbrowserx-root');
  const shadowRoot = host?.shadowRoot;
  if (!shadowRoot || !node) return false;

  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element && shadowRoot.contains(element));
}

/**
 * Reads the current page selection text and bounding rectangle.
 *
 * @returns A non-empty selection snapshot, or null when the selection should be ignored.
 */
export function readSelectionSnapshot(): SelectionSnapshot | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (isInsideChatBrowserX(selection.anchorNode)) return null;

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  let rect = range.getBoundingClientRect();
  if ((rect.width === 0 || rect.height === 0) && range.getClientRects().length) {
    rect = range.getClientRects()[0];
  }

  if (rect.width === 0 && rect.height === 0) return null;
  return { text, rect };
}

/**
 * Computes a near-selection anchor while keeping the floating bubble inside the viewport.
 *
 * @param rect - Selection bounding rectangle.
 * @param viewport - Optional viewport dimensions for tests.
 * @returns A viewport-safe bubble anchor.
 */
export function computeSelectionAnchor(rect: DOMRect, viewport?: ViewportSize): BubbleAnchor {
  const centerX = rect.left + rect.width / 2;
  const viewportWidth = viewport?.viewportWidth ?? window.innerWidth ?? 1024;
  const viewportHeight = viewport?.viewportHeight ?? window.innerHeight ?? 768;
  const bubbleWidth = Math.min(maxBubbleWidth, Math.max(0, viewportWidth - bubbleViewportMargin * 2));
  const halfBubbleWidth = bubbleWidth / 2;
  const minLeft = bubbleViewportMargin + halfBubbleWidth;
  const maxLeft = Math.max(minLeft, viewportWidth - bubbleViewportMargin - halfBubbleWidth);
  const left = clamp(centerX, minLeft, maxLeft);
  const estimatedPanelHeight = Math.min(
    maxEstimatedPanelHeight,
    Math.max(120, viewportHeight - bubbleViewportMargin * 2 - bubbleViewportGap),
  );
  const spaceAbove = rect.top - bubbleViewportMargin - bubbleViewportGap;
  const spaceBelow = viewportHeight - rect.bottom - bubbleViewportMargin - bubbleViewportGap;
  const placement: BubblePlacement = spaceAbove >= estimatedPanelHeight || spaceAbove > spaceBelow ? 'above' : 'below';

  if (placement === 'above') {
    const minTop = bubbleViewportMargin + bubbleViewportGap + estimatedPanelHeight;
    const maxTop = Math.max(minTop, viewportHeight - bubbleViewportMargin);
    return { left, top: clamp(rect.top, minTop, maxTop), placement };
  }

  const minTop = bubbleViewportMargin - bubbleViewportGap;
  const maxTop = Math.max(minTop, viewportHeight - bubbleViewportMargin - bubbleViewportGap - estimatedPanelHeight);
  return { left, top: clamp(rect.bottom, minTop, maxTop), placement };
}

/**
 * Checks whether an event originated inside the active selection bubble root.
 *
 * @param event - The document-level event to inspect.
 * @param root - The bubble root element.
 * @returns True when the event path includes the bubble root.
 */
export function isEventInsideBubble(event: Event, root: HTMLElement | null): boolean {
  if (!root) return false;
  const path = typeof event.composedPath === 'function' ? event.composedPath() : [];
  return path.includes(root);
}
