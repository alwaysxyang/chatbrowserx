import type {
  PageActionDirection,
  PageActionScrollState,
} from '../../../shared/types/tools';

const transientScrollCandidateSelector = [
  '[role="listbox"]',
  '[role="menu"]',
  '[role="tree"]',
  '[role="grid"]',
  '[class*="picker" i]',
  '[class*="selector" i]',
  '[class*="dropdown" i]',
  '[class*="listbox" i]',
  '[class*="menu" i]',
].join(',');

interface TransientScrollableOverlayCandidate {
  element: HTMLElement;
  order: number;
  rect: DOMRect;
}

/**
 * Clamps a fallback scroll position to the target's scrollable range.
 *
 * @param value - The desired scroll position.
 * @param max - The largest valid scroll position.
 * @returns A scroll position within browser-like scroll bounds.
 */
function clampScrollPosition(value: number, max: number): number {
  return Math.min(Math.max(value, 0), Math.max(max, 0));
}

/**
 * Reads the document scroll extent for one axis.
 *
 * @param documentObject - The document to inspect.
 * @param axis - The scroll axis to measure.
 * @returns The largest known document scroll size.
 */
function readDocumentScrollExtent(documentObject: Document, axis: 'x' | 'y'): number {
  const scrollingElement = documentObject.scrollingElement as HTMLElement | null;
  const documentElement = documentObject.documentElement;
  const body = documentObject.body;
  if (axis === 'x') {
    return Math.max(
      scrollingElement?.scrollWidth ?? 0,
      documentElement?.scrollWidth ?? 0,
      body?.scrollWidth ?? 0,
    );
  }

  return Math.max(
    scrollingElement?.scrollHeight ?? 0,
    documentElement?.scrollHeight ?? 0,
    body?.scrollHeight ?? 0,
  );
}

/**
 * Checks whether the window can scroll further in the requested direction.
 *
 * @param documentObject - The document associated with the window.
 * @param windowObject - The window to inspect.
 * @param direction - The requested scroll direction.
 * @returns True when the window still has additional scroll range.
 */
function canScrollWindow(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionDirection,
): boolean {
  if (direction === 'down') {
    return windowObject.scrollY + windowObject.innerHeight < readDocumentScrollExtent(documentObject, 'y') - 1;
  }
  if (direction === 'up') {
    return windowObject.scrollY > 0;
  }
  if (direction === 'right') {
    return windowObject.scrollX + windowObject.innerWidth < readDocumentScrollExtent(documentObject, 'x') - 1;
  }
  return windowObject.scrollX > 0;
}

/**
 * Checks whether an element can scroll further in the requested direction.
 *
 * @param element - The candidate scroll container.
 * @param direction - The requested scroll direction.
 * @param windowObject - The window that owns the element.
 * @returns True when the element is a usable scroll target.
 */
export function canScrollElement(
  element: Element,
  direction: PageActionDirection | undefined,
  windowObject: Window,
): boolean {
  const htmlElement = element as HTMLElement;
  const style = windowObject.getComputedStyle(htmlElement);
  const canScrollY = ['auto', 'scroll', 'overlay'].includes(style.overflowY);
  const canScrollX = ['auto', 'scroll', 'overlay'].includes(style.overflowX);

  if (direction === 'down') {
    return canScrollY && htmlElement.scrollHeight > htmlElement.clientHeight && htmlElement.scrollTop + htmlElement.clientHeight < htmlElement.scrollHeight - 1;
  }
  if (direction === 'up') {
    return canScrollY && htmlElement.scrollHeight > htmlElement.clientHeight && htmlElement.scrollTop > 0;
  }
  if (direction === 'right') {
    return canScrollX && htmlElement.scrollWidth > htmlElement.clientWidth && htmlElement.scrollLeft + htmlElement.clientWidth < htmlElement.scrollWidth - 1;
  }
  if (direction === 'left') {
    return canScrollX && htmlElement.scrollWidth > htmlElement.clientWidth && htmlElement.scrollLeft > 0;
  }

  return false;
}

/**
 * Finds the nearest scrollable ancestor from an origin element.
 *
 * @param element - The origin element for wheel-like bubbling.
 * @param direction - The requested scroll direction.
 * @param windowObject - The window that owns the element.
 * @returns The nearest ancestor that can scroll in the requested direction.
 */
export function findScrollableAncestor(
  element: Element | null | undefined,
  direction: PageActionDirection,
  windowObject: Window,
): HTMLElement | undefined {
  for (let current = element; current; current = current.parentElement) {
    if (canScrollElement(current, direction, windowObject)) {
      return current as HTMLElement;
    }
  }
  return undefined;
}

/**
 * Reads a lowercase class string from an element.
 *
 * @param element - The element to inspect.
 * @returns Lowercase class text.
 */
function readClassName(element: Element): string {
  return typeof element.className === 'string' ? element.className.toLowerCase() : '';
}

/**
 * Checks whether an element looks like a transient choice popup.
 *
 * @param element - The element to inspect.
 * @returns True when role or class semantics match popup choice UI.
 */
function hasTransientChoiceSignal(element: Element): boolean {
  const role = element.getAttribute('role')?.trim().split(/\s+/)[0]?.toLowerCase();
  if (role === 'listbox' || role === 'menu' || role === 'tree' || role === 'grid') return true;

  return /(^|[-_\s])(picker|selector|select|dropdown|listbox|menu)([-_\s]|$)/.test(readClassName(element));
}

/**
 * Checks whether the element or a near ancestor is positioned like a floating popup.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the element.
 * @returns True when the element belongs to a positioned overlay context.
 */
function hasFloatingOverlayContext(element: Element, windowObject: Window): boolean {
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < 5) {
    const style = windowObject.getComputedStyle(current as HTMLElement);
    if (style.position === 'absolute' || style.position === 'fixed') return true;
    current = current.parentElement;
    depth += 1;
  }

  return false;
}

/**
 * Checks whether a rectangle is visible and sized like a popup rather than page chrome.
 *
 * @param rect - The candidate rectangle.
 * @param windowObject - The window that owns the viewport.
 * @returns True when the rectangle is within the viewport and not page-sized.
 */
function isFloatingPopupRect(rect: DOMRect, windowObject: Window): boolean {
  const intersectsViewport = rect.width > 0 &&
    rect.height > 0 &&
    rect.right > 0 &&
    rect.bottom > 0 &&
    rect.left < windowObject.innerWidth &&
    rect.top < windowObject.innerHeight;
  if (!intersectsViewport) return false;

  return rect.width < windowObject.innerWidth * 0.95 && rect.height < windowObject.innerHeight * 0.95;
}

/**
 * Checks whether the candidate or one of its children is hit-test visible.
 *
 * @param element - The candidate element.
 * @param rect - The candidate rectangle.
 * @param documentObject - The document used for hit testing.
 * @returns True when the popup is not fully covered at its center.
 */
function isCenterHitVisible(element: Element, rect: DOMRect, documentObject: Document): boolean {
  const x = Math.round(rect.left + rect.width / 2);
  const y = Math.round(rect.top + rect.height / 2);
  const hit = documentObject.elementFromPoint(x, y);
  return Boolean(hit && (hit === element || element.contains(hit)));
}

/**
 * Compares transient popup scroll candidates by the column users are most likely operating.
 *
 * @param first - The first candidate to compare.
 * @param second - The second candidate to compare.
 * @returns A sort order that prefers terminal cascader columns.
 */
function compareTransientScrollableOverlays(
  first: TransientScrollableOverlayCandidate,
  second: TransientScrollableOverlayCandidate,
): number {
  const leftDelta = second.rect.left - first.rect.left;
  if (Math.abs(leftDelta) > 1) return leftDelta;

  const topDelta = first.rect.top - second.rect.top;
  if (Math.abs(topDelta) > 1) return topDelta;

  return second.order - first.order;
}

/**
 * Finds a visible floating picker/list popup that should receive wheel-like scrolling.
 *
 * @param documentObject - The document to inspect.
 * @param windowObject - The window that owns the document.
 * @param direction - The requested scroll direction.
 * @returns A scrollable popup list element when one is active in the viewport.
 */
function findTransientScrollableOverlay(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionDirection,
): HTMLElement | undefined {
  const candidates = Array.from(documentObject.querySelectorAll<HTMLElement>(transientScrollCandidateSelector));
  const overlays = candidates.reduce<TransientScrollableOverlayCandidate[]>((matches, candidate, order) => {
    if (!hasTransientChoiceSignal(candidate)) return matches;
    if (!canScrollElement(candidate, direction, windowObject)) return matches;
    if (!hasFloatingOverlayContext(candidate, windowObject)) return matches;

    const rect = candidate.getBoundingClientRect();
    if (isFloatingPopupRect(rect, windowObject) && isCenterHitVisible(candidate, rect, documentObject)) {
      matches.push({ element: candidate, order, rect });
    }
    return matches;
  }, []);

  overlays.sort(compareTransientScrollableOverlays);
  return overlays[0]?.element;
}

/**
 * Finds the best scroll target for pages that use nested scroll containers.
 *
 * @param documentObject - The document to inspect.
 * @param windowObject - The window that owns the document.
 * @param direction - The requested scroll direction.
 * @returns A scrollable element when one is visible.
 */
export function findScrollableElement(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionDirection,
): HTMLElement | undefined {
  const transientOverlay = findTransientScrollableOverlay(documentObject, windowObject, direction);
  if (transientOverlay) return transientOverlay;

  const centerX = Math.max(0, Math.floor(windowObject.innerWidth / 2));
  const centerY = Math.max(0, Math.floor(windowObject.innerHeight / 2));
  const current = documentObject.elementFromPoint(centerX, centerY);
  return findScrollableAncestor(current, direction, windowObject);
}

/**
 * Scrolls an element by the provided deltas.
 *
 * @param target - The element to scroll.
 * @param left - Horizontal delta.
 * @param top - Vertical delta.
 * @param direction - The requested scroll direction.
 * @param windowObject - The window that owns the element.
 * @param ref - Optional interactables snapshot ref used for telemetry.
 * @param fallback - Whether this element was used as a fallback target.
 * @returns Scroll telemetry for the model.
 */
export function scrollElement(
  target: HTMLElement,
  left: number,
  top: number,
  direction: PageActionDirection,
  windowObject: Window,
  ref?: string,
  fallback?: boolean,
): PageActionScrollState {
  const leftBefore = target.scrollLeft;
  const topBefore = target.scrollTop;

  if (typeof target.scrollBy === 'function') {
    target.scrollBy({ left, top, behavior: 'auto' });
  } else {
    target.scrollLeft = clampScrollPosition(target.scrollLeft + left, target.scrollWidth - target.clientWidth);
    target.scrollTop = clampScrollPosition(target.scrollTop + top, target.scrollHeight - target.clientHeight);
  }

  const leftAfter = target.scrollLeft;
  const topAfter = target.scrollTop;
  return {
    target: 'element',
    ...(ref ? { ref } : {}),
    ...(fallback ? { fallback: true } : {}),
    leftBefore,
    leftAfter,
    topBefore,
    topAfter,
    scrolled: leftBefore !== leftAfter || topBefore !== topAfter,
    canScrollMore: canScrollElement(target, direction, windowObject),
  };
}

/**
 * Scrolls the window and reports before/after viewport positions.
 *
 * @param documentObject - The document associated with the window.
 * @param windowObject - The window to scroll.
 * @param direction - The requested scroll direction.
 * @param left - Horizontal delta.
 * @param top - Vertical delta.
 * @returns Scroll telemetry for the model.
 */
export function scrollWindow(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionDirection,
  left: number,
  top: number,
  ref?: string,
  fallback?: boolean,
): PageActionScrollState {
  const leftBefore = windowObject.scrollX;
  const topBefore = windowObject.scrollY;
  windowObject.scrollBy({ left, top, behavior: 'auto' });
  const leftAfter = windowObject.scrollX;
  const topAfter = windowObject.scrollY;
  return {
    target: 'window',
    ...(ref ? { ref } : {}),
    ...(fallback ? { fallback: true } : {}),
    leftBefore,
    leftAfter,
    topBefore,
    topAfter,
    scrolled: leftBefore !== leftAfter || topBefore !== topAfter,
    canScrollMore: canScrollWindow(documentObject, windowObject, direction),
  };
}

/**
 * Scrolls a target element or the window when no nested scroll target is available.
 *
 * @param documentObject - The document to inspect.
 * @param windowObject - The window to scroll.
 * @param direction - The requested scroll direction.
 * @param left - Horizontal delta.
 * @param top - Vertical delta.
 * @param ref - Optional interactables snapshot ref used for telemetry.
 * @param fallback - Whether fallback target selection was used.
 * @returns Scroll telemetry for the model.
 */
export function scrollPageOrContainer(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionDirection,
  left: number,
  top: number,
  ref?: string,
  fallback?: boolean,
): PageActionScrollState {
  const target = findScrollableElement(documentObject, windowObject, direction);
  if (!target) {
    return scrollWindow(documentObject, windowObject, direction, left, top, ref, fallback);
  }

  return scrollElement(target, left, top, direction, windowObject, ref, fallback);
}
