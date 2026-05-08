import type {
  PageActionDirection,
  PageActionScrollState,
} from '../../../shared/types/tools';
import { visibleAreaScore } from './geometry';

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
 * Finds the best scroll target for pages that use nested scroll containers.
 *
 * @param documentObject - The document to inspect.
 * @param windowObject - The window that owns the document.
 * @param direction - The requested scroll direction.
 * @returns A scrollable element when one is visible.
 */
function findScrollableElement(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionDirection,
): HTMLElement | undefined {
  const centerX = Math.max(0, Math.floor(windowObject.innerWidth / 2));
  const centerY = Math.max(0, Math.floor(windowObject.innerHeight / 2));
  let current = documentObject.elementFromPoint(centerX, centerY);

  for (; current; current = current.parentElement) {
    if (canScrollElement(current, direction, windowObject)) {
      return current as HTMLElement;
    }
  }

  return Array.from(documentObject.querySelectorAll('body *'))
    .filter((element) => canScrollElement(element, direction, windowObject))
    .sort((a, b) => visibleAreaScore(b, windowObject) - visibleAreaScore(a, windowObject))[0] as HTMLElement | undefined;
}

/**
 * Scrolls an element by the provided deltas.
 *
 * @param target - The element to scroll.
 * @param left - Horizontal delta.
 * @param top - Vertical delta.
 * @param ref - Optional interactables snapshot ref used for telemetry.
 * @param fallback - Whether this element was used as a fallback target.
 * @returns Scroll telemetry for the model.
 */
export function scrollElement(
  target: HTMLElement,
  left: number,
  top: number,
  ref?: string,
  fallback?: boolean,
): PageActionScrollState {
  const leftBefore = target.scrollLeft;
  const topBefore = target.scrollTop;

  if (typeof target.scrollBy === 'function') {
    target.scrollBy({ left, top, behavior: 'auto' });
  } else {
    target.scrollLeft += left;
    target.scrollTop += top;
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
  };
}

/**
 * Scrolls the window and reports before/after viewport positions.
 *
 * @param windowObject - The window to scroll.
 * @param left - Horizontal delta.
 * @param top - Vertical delta.
 * @returns Scroll telemetry for the model.
 */
function scrollWindow(windowObject: Window, left: number, top: number): PageActionScrollState {
  const leftBefore = windowObject.scrollX;
  const topBefore = windowObject.scrollY;
  windowObject.scrollBy({ left, top, behavior: 'auto' });
  const leftAfter = windowObject.scrollX;
  const topAfter = windowObject.scrollY;
  return {
    target: 'window',
    leftBefore,
    leftAfter,
    topBefore,
    topAfter,
    scrolled: leftBefore !== leftAfter || topBefore !== topAfter,
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
    return scrollWindow(windowObject, left, top);
  }

  return scrollElement(target, left, top, ref, fallback);
}
