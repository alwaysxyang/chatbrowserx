import type { ScreenshotDocumentRange, ScreenshotRect } from './screenshot-types';

export type ScreenshotScrollTarget = Window | HTMLElement;

export interface LongScreenshotCaptureArea {
  captureRect: ScreenshotRect;
  range: ScreenshotDocumentRange;
}

/**
 * Check whether an element should be ignored during screenshot hit testing.
 *
 * @param element - The hit-tested element
 * @param ignoredElements - The elements owned by the screenshot overlay host
 * @returns True when the hit-tested element belongs to the ignored set
 */
function isIgnoredHitTestElement(element: Element, ignoredElements: Element[]): boolean {
  return ignoredElements.some((ignoredElement) => ignoredElement === element || ignoredElement.contains(element));
}

/**
 * Resolve the first non-ignored element from `document.elementsFromPoint`.
 *
 * @param clientX - The viewport X coordinate
 * @param clientY - The viewport Y coordinate
 * @param ignoredElements - The elements owned by the screenshot overlay host
 * @returns The first usable element below the pointer, if available
 */
function resolveUnderlyingElementFromStack(
  clientX: number,
  clientY: number,
  ignoredElements: Element[],
): Element | null {
  if (typeof document.elementsFromPoint !== 'function') {
    return null;
  }

  return document.elementsFromPoint(clientX, clientY).find((element) => !isIgnoredHitTestElement(element, ignoredElements))
    ?? null;
}

/**
 * Resolve the first non-ignored element from `document.elementFromPoint`.
 * When the top hit belongs to the overlay host, temporarily disable pointer events
 * on ignored elements so the underlying page element can be queried.
 *
 * @param clientX - The viewport X coordinate
 * @param clientY - The viewport Y coordinate
 * @param ignoredElements - The elements owned by the screenshot overlay host
 * @returns The first usable element below the pointer, if available
 */
function resolveUnderlyingElementFromSingleHitTest(
  clientX: number,
  clientY: number,
  ignoredElements: Element[],
): Element | null {
  if (typeof document.elementFromPoint !== 'function') {
    return null;
  }

  const element = document.elementFromPoint(clientX, clientY);
  if (!element || !isIgnoredHitTestElement(element, ignoredElements)) {
    return element;
  }

  const htmlElements = ignoredElements.filter((ignoredElement): ignoredElement is HTMLElement => ignoredElement instanceof HTMLElement);
  const previousPointerEvents = htmlElements.map((ignoredElement) => ignoredElement.style.pointerEvents);

  htmlElements.forEach((ignoredElement) => {
    ignoredElement.style.pointerEvents = 'none';
  });

  try {
    const underlyingElement = document.elementFromPoint(clientX, clientY);
    return underlyingElement && !isIgnoredHitTestElement(underlyingElement, ignoredElements) ? underlyingElement : null;
  } finally {
    htmlElements.forEach((ignoredElement, index) => {
      ignoredElement.style.pointerEvents = previousPointerEvents[index] ?? '';
    });
  }
}

/**
 * Check whether a screenshot scroll target is the top-level window.
 *
 * @param target - The scroll target to inspect
 * @returns True when the target is the current window
 */
function isWindowScrollTarget(target: ScreenshotScrollTarget): target is Window {
  return target === window;
}

/**
 * Check whether an element can scroll vertically.
 *
 * @param element - The candidate DOM element
 * @returns True when the element can scroll vertically
 */
function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;

  return (
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay')
    && element.scrollHeight > element.clientHeight
  );
}

/**
 * Find the nearest scrollable ancestor for a DOM node.
 *
 * @param target - The DOM node under the pointer
 * @returns The nearest scrollable ancestor, or `window` as a fallback
 */
function findScrollableAncestor(target: Element | null): ScreenshotScrollTarget {
  let current = target;

  while (current) {
    if (current instanceof HTMLElement && isScrollableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return window;
}

/**
 * Resolve the real page scroll target under a viewport point, ignoring overlay UI layers.
 *
 * @param clientX - The viewport X coordinate
 * @param clientY - The viewport Y coordinate
 * @param ignoredElements - Elements that belong to the screenshot overlay host and must be skipped
 * @returns The scrollable target that should receive screenshot scrolling
 */
export function resolveScreenshotScrollTargetAtPoint(
  clientX: number,
  clientY: number,
  ignoredElements: Element[] = [],
): ScreenshotScrollTarget {
  const underlyingElement = resolveUnderlyingElementFromStack(clientX, clientY, ignoredElements)
    ?? resolveUnderlyingElementFromSingleHitTest(clientX, clientY, ignoredElements);

  return findScrollableAncestor(underlyingElement);
}

/**
 * Scroll the provided screenshot target using viewport wheel deltas.
 *
 * @param target - The scrollable target resolved for screenshot interaction
 * @param deltaX - The wheel delta on the X axis
 * @param deltaY - The wheel delta on the Y axis
 */
export function scrollScreenshotTarget(target: ScreenshotScrollTarget, deltaX: number, deltaY: number): void {
  if (isWindowScrollTarget(target)) {
    window.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
    return;
  }

  target.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
}

/**
 * Read the current vertical scroll offset for a screenshot scroll target.
 *
 * @param target - The scroll target to inspect
 * @returns The current vertical scroll offset
 */
function getScreenshotScrollTop(target: ScreenshotScrollTarget): number {
  return isWindowScrollTarget(target) ? window.scrollY : target.scrollTop;
}

/**
 * Build the logical capture area for a long screenshot using the active scroll target.
 *
 * @param selection - The current screenshot selection in viewport coordinates
 * @param target - The scroll target that owns the moving content
 * @returns The crop rectangle and logical content range represented by the current viewport
 */
export function createLongScreenshotCaptureArea(
  selection: ScreenshotRect,
  target: ScreenshotScrollTarget,
): LongScreenshotCaptureArea {
  if (isWindowScrollTarget(target)) {
    const startY = window.scrollY + selection.top;

    return {
      captureRect: selection,
      range: {
        startY,
        endY: startY + selection.height,
      },
    };
  }

  const rect = target.getBoundingClientRect();
  const visibleTop = Math.min(
    Math.max(Math.max(selection.top, rect.top), 0),
    Math.max(0, window.innerHeight - 1),
  );
  const visibleBottom = Math.min(
    window.innerHeight,
    Math.max(visibleTop + 1, Math.min(selection.top + selection.height, rect.bottom)),
  );
  const height = Math.max(1, visibleBottom - visibleTop);
  const startY = getScreenshotScrollTop(target) + Math.max(0, visibleTop - rect.top);

  return {
    captureRect: {
      left: selection.left,
      top: visibleTop,
      width: selection.width,
      height,
    },
    range: {
      startY,
      endY: startY + height,
    },
  };
}
