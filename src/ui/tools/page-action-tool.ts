import {
  isPageActionToolRequestMessage,
  type PageActionElementState,
  type PageActionScrollState,
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../shared/types/tool';
import { isLatestInteractablesSnapshot, resolveLatestInteractableRef } from './get-page-interactables-tool';
import {
  showVirtualClickFeedback,
  showVirtualClickTarget,
  showVirtualDrag,
  showVirtualMouseMove,
  showVirtualScroll,
  showVirtualType,
  type ViewportPoint,
} from './page-action-overlay';

/**
 * Returns the center point of a DOM rectangle in viewport coordinates.
 *
 * @param rect - The DOM rectangle.
 * @returns The center point.
 */
function rectCenter(rect: DOMRect): ViewportPoint {
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
function dispatchMouseEvent(element: Element, type: string, point: ViewportPoint): void {
  element.dispatchEvent(new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    buttons: type === 'mouseup' || type === 'click' ? 0 : 1,
  }));
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
function readElementState(element: Element): PageActionElementState | undefined {
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
function resolveStateElement(element: Element): Element {
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
function didStateChange(before: PageActionElementState | undefined, after: PageActionElementState | undefined): boolean {
  return JSON.stringify(before ?? {}) !== JSON.stringify(after ?? {});
}

/**
 * Returns true when an element can receive direct text writes.
 *
 * @param element - The element to inspect.
 * @returns True when `writeText` can write to the element.
 */
function isWritableTextElement(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase();
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type);
  }

  return element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === ''));
}

/**
 * Returns true when a writable target is currently usable for text input.
 *
 * @param element - The candidate element.
 * @param windowObject - The window that owns the element.
 * @returns True when the element should receive `page_type` writes.
 */
function isUsableTextTarget(element: Element, windowObject: Window): boolean {
  if (!isWritableTextElement(element)) return false;
  if ('disabled' in element && Boolean((element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).disabled)) {
    return false;
  }

  const htmlElement = element as HTMLElement;
  const style = windowObject.getComputedStyle(htmlElement);
  return !htmlElement.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
}

/**
 * Finds the best writable descendant for composite editor containers.
 *
 * @param element - The requested action target.
 * @param windowObject - The window that owns the element.
 * @returns A writable element when available.
 */
function resolveTextTarget(element: Element, windowObject: Window): Element {
  if (isUsableTextTarget(element, windowObject)) return element;
  return Array.from(element.querySelectorAll(
    '[contenteditable="true"], [contenteditable=""], textarea, select, input:not([type="hidden"])',
  )).find((candidate) => isUsableTextTarget(candidate, windowObject)) ?? element;
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
 * Checks whether an element can scroll further in the requested direction.
 *
 * @param element - The candidate scroll container.
 * @param direction - The requested scroll direction.
 * @param windowObject - The window that owns the element.
 * @returns True when the element is a usable scroll target.
 */
function canScrollElement(element: Element, direction: PageActionToolRequestPayload['direction'], windowObject: Window): boolean {
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
function scrollElement(
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
function scrollPageOrContainer(
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

/**
 * Resolves a required ref to a currently usable element.
 *
 * @param ref - The latest snapshot ref.
 * @param sid - The latest snapshot ID.
 * @returns The element and rectangle, or an error result.
 */
function resolveTarget(ref: string | undefined, sid: string | undefined): { element: Element; rect: DOMRect } | PageActionToolResult {
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
 * Writes text into an input-like element and dispatches form events.
 *
 * @param element - The target element.
 * @param text - Text to write.
 * @param clear - Whether to replace existing content.
 * @returns True when text was written.
 */
function writeText(element: Element, text: string, clear: boolean | undefined): boolean {
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
 * Executes a minimal page action in the content script.
 *
 * @param payload - The action payload.
 * @param documentObject - The document to operate on.
 * @param windowObject - The window to operate on.
 * @returns A structured action result.
 */
export async function executePageAction(
  payload: PageActionToolRequestPayload,
  documentObject: Document = document,
  windowObject: Window = window,
): Promise<PageActionToolResult> {
  if (payload.action === 'scroll') {
    const direction = payload.direction ?? 'down';
    const amount = Math.min(Math.max(payload.amount ?? Math.round(windowObject.innerHeight * 0.7), 1), 2000);
    const top = direction === 'up' ? -amount : direction === 'down' ? amount : 0;
    const left = direction === 'left' ? -amount : direction === 'right' ? amount : 0;
    await showVirtualScroll(documentObject, direction);

    if (payload.ref) {
      const target = resolveTarget(payload.ref, payload.sid);
      if ('ok' in target) return { ...target, action: 'scroll', ref: payload.ref };
      if (!canScrollElement(target.element, direction, windowObject)) {
        return {
          ok: true,
          action: 'scroll',
          ref: payload.ref,
          scroll: scrollPageOrContainer(documentObject, windowObject, direction, left, top, payload.ref, true),
        };
      }
      return {
        ok: true,
        action: 'scroll',
        ref: payload.ref,
        scroll: scrollElement(target.element as HTMLElement, left, top, payload.ref),
      };
    }

    return {
      ok: true,
      action: 'scroll',
      scroll: scrollPageOrContainer(documentObject, windowObject, direction, left, top),
    };
  }

  if (payload.action === 'drag') {
    const from = resolveTarget(payload.fromRef, payload.sid);
    if ('ok' in from) return { ...from, action: 'drag', ref: payload.fromRef };
    const to = resolveTarget(payload.toRef, payload.sid);
    if ('ok' in to) return { ...to, action: 'drag', ref: payload.fromRef };

    const fromPoint = rectCenter(from.rect);
    const toPoint = rectCenter(to.rect);
    await showVirtualDrag(documentObject, fromPoint, toPoint);
    dispatchMouseEvent(from.element, 'mousedown', fromPoint);
    dispatchMouseEvent(to.element, 'mousemove', toPoint);
    dispatchMouseEvent(to.element, 'mouseup', toPoint);
    return { ok: true, action: 'drag', ref: payload.fromRef };
  }

  const target = resolveTarget(payload.ref, payload.sid);
  if ('ok' in target) return { ...target, action: payload.action, ref: payload.ref };

  const point = rectCenter(target.rect);

  if (payload.action === 'mouse_move') {
    await showVirtualMouseMove(documentObject, point);
    dispatchMouseEvent(target.element, 'mousemove', point);
    return { ok: true, action: 'mouse_move', ref: payload.ref };
  }

  if (payload.action === 'click') {
    const stateElement = resolveStateElement(target.element);
    const stateBefore = readElementState(stateElement);
    await showVirtualClickTarget(documentObject, point);
    dispatchMouseEvent(target.element, 'mousedown', point);
    dispatchMouseEvent(target.element, 'mouseup', point);
    dispatchMouseEvent(target.element, 'click', point);
    await showVirtualClickFeedback(documentObject, point);
    const stateAfter = readElementState(stateElement);
    return {
      ok: true,
      action: 'click',
      ref: payload.ref,
      changed: didStateChange(stateBefore, stateAfter),
      ...(stateBefore ? { stateBefore } : {}),
      ...(stateAfter ? { stateAfter } : {}),
    };
  }

  if (payload.action === 'type') {
    const textTarget = resolveTextTarget(target.element, windowObject);
    const stateBefore = readElementState(textTarget);
    await showVirtualMouseMove(documentObject, point);
    await showVirtualType(documentObject, target.rect);
    if (!writeText(textTarget, payload.text ?? '', payload.clear)) {
      return { ok: false, action: 'type', ref: payload.ref, error: 'PAGE_ACTION_TARGET_NOT_TEXT_INPUT' };
    }
    const stateAfter = readElementState(textTarget);
    return {
      ok: true,
      action: 'type',
      ref: payload.ref,
      changed: didStateChange(stateBefore, stateAfter),
      ...(stateBefore ? { stateBefore } : {}),
      ...(stateAfter ? { stateAfter } : {}),
    };
  }

  return { ok: false, action: payload.action, ref: payload.ref, error: 'PAGE_ACTION_UNSUPPORTED' };
}

/**
 * Registers the content-script listener for page action tool requests.
 */
export function registerPageActionToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isPageActionToolRequestMessage(message)) {
      return undefined;
    }

    void executePageAction(message, document, window).then(sendResponse);
    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
}
