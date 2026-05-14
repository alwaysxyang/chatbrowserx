import type {
  PageActionDirection,
  PageActionScrollState,
} from '../../../shared/types/tools';

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
