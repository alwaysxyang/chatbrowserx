import {
  type PageActionElementState,
  type PageActionScrollState,
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../../shared/types/tools';
import { isLatestInteractablesSnapshot, resolveLatestInteractableRef } from './snapshot-store';
import type { ViewportPoint } from './virtual-cursor';

/**
 * Returns the center point of a DOM rectangle in viewport coordinates.
 *
 * @param rect - The DOM rectangle.
 * @returns The center point.
 */
export function rectCenter(rect: DOMRect): ViewportPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Dispatches a mouse event on an element.
 *
 * @param element - The event target.
 * @param type - The mouse event type.
 * @param point - The viewport point.
 */
export function dispatchMouseEvent(element: Element, type: string, point: ViewportPoint): void {
  element.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    buttons: type === 'mouseup' || type === 'click' ? 0 : 1,
  }));
}

/**
 * Resolves a required ref to a currently usable element.
 *
 * @param ref - The latest snapshot ref.
 * @param sid - The latest snapshot ID.
 * @returns The element and rectangle, or an error result.
 */
export function resolveActionTarget(
  ref: string | undefined,
  sid: string | undefined,
): { element: Element; rect: DOMRect } | PageActionToolResult {
  if (!ref) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_REF_REQUIRED' };
  }

  if (!sid) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_SNAPSHOT_REQUIRED' };
  }

  if (!isLatestInteractablesSnapshot(sid)) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_SNAPSHOT_EXPIRED' };
  }

  const element = resolveLatestInteractableRef(ref);
  if (!element) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_REF_NOT_FOUND' };
  }

  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_TARGET_UNAVAILABLE' };
  }

  return { element, rect };
}

/**
 * Truncates action telemetry text so tool results stay compact.
 *
 * @param value - Text to truncate.
 * @returns A single-line text sample.
 */
function truncateStateText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 120 ? normalized.slice(0, 120).trim() : normalized;
}

/**
 * Reads a compact measurable state for an action target.
 *
 * @param element - The element to inspect.
 * @returns State fields that can help the model verify an action.
 */
export function readElementState(element: Element): PageActionElementState | undefined {
  const state: PageActionElementState = {};

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      state.checked = element.checked;
    } else {
      state.value = element.value;
    }
  } else if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    state.value = element.value;
  } else if (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '')
  ) {
    state.text = truncateStateText(element.textContent ?? '');
  }

  const ariaChecked = element.getAttribute('aria-checked');
  const ariaExpanded = element.getAttribute('aria-expanded');
  const ariaPressed = element.getAttribute('aria-pressed');
  if (state.checked === undefined && (ariaChecked === 'true' || ariaChecked === 'false')) {
    state.checked = ariaChecked === 'true';
  }
  if (ariaExpanded === 'true' || ariaExpanded === 'false') {
    state.expanded = ariaExpanded === 'true';
  }
  if (ariaPressed === 'true' || ariaPressed === 'false') {
    state.pressed = ariaPressed === 'true';
  }

  return Object.keys(state).length ? state : undefined;
}

/**
 * Finds the nearest element that exposes checkable, expandable, or pressable state.
 *
 * @param element - The action target or one of its descendants.
 * @returns The nearest stateful element or the original element.
 */
export function resolveStateElement(element: Element): Element {
  const label = element.closest('label') as HTMLLabelElement | null;
  if (label?.control) return label.control;

  const stateful = element.closest('[aria-checked], [aria-expanded], [aria-pressed]');
  if (stateful) return stateful;

  if (element instanceof HTMLLabelElement && element.control) return element.control;
  const nestedInput = element.querySelector('input[type="checkbox"], input[type="radio"]');
  return nestedInput ?? element;
}

/**
 * Compares two compact element states.
 *
 * @param before - State before the action.
 * @param after - State after the action.
 * @returns True when at least one measurable field changed.
 */
export function didStateChange(
  before: PageActionElementState | undefined,
  after: PageActionElementState | undefined,
): boolean {
  return JSON.stringify(before ?? {}) !== JSON.stringify(after ?? {});
}

/**
 * Writes a value through the native DOM property setter so controlled inputs see the change.
 *
 * @param element - The target form element.
 * @param value - The next value.
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(element, 'value');
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const setter = prototypeDescriptor?.set && descriptor?.set !== prototypeDescriptor.set
    ? prototypeDescriptor.set
    : descriptor?.set;

  if (setter) {
    setter.call(element, value);
    return;
  }

  element.value = value;
}

/**
 * Writes text into an input-like element and dispatches form events.
 *
 * @param element - The target element.
 * @param text - Text to write.
 * @param clear - Whether to replace existing content.
 * @returns True when text was written.
 */
export function writeText(element: Element, text: string, clear: boolean | undefined): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    setNativeValue(element, clear ? text : `${element.value}${text}`);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (element instanceof HTMLSelectElement) {
    element.focus();
    setNativeValue(element, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '')
  ) {
    element.focus();
    element.textContent = clear ? text : `${element.textContent ?? ''}${text}`;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
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
  direction: PageActionToolRequestPayload['direction'],
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
 * Scores how much of an element is visible in the viewport.
 *
 * @param element - The element to score.
 * @param windowObject - The window that owns the element.
 * @returns The visible area score.
 */
function visibleAreaScore(element: Element, windowObject: Window): number {
  const rect = element.getBoundingClientRect();
  const width = Math.max(0, Math.min(rect.right, windowObject.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, windowObject.innerHeight) - Math.max(rect.top, 0));
  return width * height;
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
  direction: PageActionToolRequestPayload['direction'],
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
 */
export function scrollPageOrContainer(
  documentObject: Document,
  windowObject: Window,
  direction: PageActionToolRequestPayload['direction'],
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
