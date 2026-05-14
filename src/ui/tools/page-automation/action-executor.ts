import {
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../../shared/types/tools';
import { resolveTextTarget } from './dom-targets';
import {
  canScrollElement,
  findScrollableAncestor,
  findScrollableElement,
  scrollElement,
  scrollPageOrContainer,
  scrollWindow,
} from './action-scroll';
import { didStateChange, readElementState, resolveStateElement } from './action-state';
import { readFocusedElement, resolveActionTarget } from './action-targets';
import { rectCenter, type ViewportPoint } from './geometry';
import { writeText } from './text-writer';
import {
  showVirtualClickFeedback,
  showVirtualClickTarget,
  showVirtualDrag,
  showVirtualMouseMove,
  showVirtualScroll,
  showVirtualType,
} from './virtual-cursor';

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
 * Computes a human-scale scroll distance from the target's visible size.
 *
 * @param requestedAmount - Optional model-provided scroll distance.
 * @param visibleSize - The visible height or width of the scroll target.
 * @returns A positive scroll distance bounded to the target's visible area.
 */
function readHumanScrollAmount(requestedAmount: number | undefined, visibleSize: number): number {
  const fallbackSize = Math.max(visibleSize, 1);
  const defaultAmount = Math.max(Math.round(fallbackSize * 0.7), 1);
  const maxExplicitAmount = Math.max(Math.round(fallbackSize * 0.8), 1);
  if (requestedAmount === undefined) return defaultAmount;
  return Math.min(Math.max(requestedAmount, 1), maxExplicitAmount);
}

/**
 * Builds directional scroll deltas from a positive scroll amount.
 *
 * @param direction - The requested scroll direction.
 * @param amount - The positive scroll amount.
 * @returns Horizontal and vertical deltas.
 */
function createScrollDeltas(direction: PageActionToolRequestPayload['direction'], amount: number): { left: number; top: number } {
  return {
    top: direction === 'up' ? -amount : direction === 'down' ? amount : 0,
    left: direction === 'left' ? -amount : direction === 'right' ? amount : 0,
  };
}

/**
 * Reads the visible size that should constrain scroll distance.
 *
 * @param element - Optional scroll target element.
 * @param direction - The requested scroll direction.
 * @param windowObject - The window used as fallback.
 * @returns The relevant visible height or width.
 */
function readScrollVisibleSize(
  element: Element | undefined,
  direction: PageActionToolRequestPayload['direction'],
  windowObject: Window,
): number {
  if (direction === 'left' || direction === 'right') {
    return element instanceof HTMLElement ? element.clientWidth : windowObject.innerWidth;
  }

  return element instanceof HTMLElement ? element.clientHeight : windowObject.innerHeight;
}

/**
 * Executes a page scroll action and returns scroll telemetry.
 *
 * @param payload - The scroll action payload.
 * @param documentObject - The document to operate on.
 * @param windowObject - The window to operate on.
 * @returns A structured scroll action result.
 */
async function executeScrollAction(
  payload: PageActionToolRequestPayload,
  documentObject: Document,
  windowObject: Window,
): Promise<PageActionToolResult> {
  const direction = payload.direction ?? 'down';
  await showVirtualScroll(documentObject, direction);

  if (payload.ref) {
    const target = resolveActionTarget(payload.ref, payload.sid);
    if ('ok' in target) return { ...target, action: 'scroll', ref: payload.ref };
    if (!canScrollElement(target.element, direction, windowObject)) {
      const fallbackTarget = findScrollableAncestor(target.element.parentElement, direction, windowObject);
      const amount = readHumanScrollAmount(payload.amount, readScrollVisibleSize(fallbackTarget, direction, windowObject));
      const { left, top } = createScrollDeltas(direction, amount);
      return {
        ok: true,
        action: 'scroll',
        ref: payload.ref,
        scroll: fallbackTarget
          ? scrollElement(fallbackTarget, left, top, direction, windowObject, payload.ref, true)
          : scrollWindow(documentObject, windowObject, direction, left, top, payload.ref, true),
      };
    }
    const amount = readHumanScrollAmount(payload.amount, readScrollVisibleSize(target.element, direction, windowObject));
    const { left, top } = createScrollDeltas(direction, amount);
    return {
      ok: true,
      action: 'scroll',
      ref: payload.ref,
      scroll: scrollElement(target.element as HTMLElement, left, top, direction, windowObject, payload.ref),
    };
  }

  const scrollTarget = findScrollableElement(documentObject, windowObject, direction);
  const amount = readHumanScrollAmount(payload.amount, readScrollVisibleSize(scrollTarget, direction, windowObject));
  const { left, top } = createScrollDeltas(direction, amount);
  return {
    ok: true,
    action: 'scroll',
    scroll: scrollPageOrContainer(documentObject, windowObject, direction, left, top),
  };
}

/**
 * Executes a drag action between two latest snapshot refs.
 *
 * @param payload - The drag action payload.
 * @param documentObject - The document to operate on.
 * @returns A structured drag action result.
 */
async function executeDragAction(
  payload: PageActionToolRequestPayload,
  documentObject: Document,
): Promise<PageActionToolResult> {
  const from = resolveActionTarget(payload.fromRef, payload.sid);
  if ('ok' in from) return { ...from, action: 'drag', ref: payload.fromRef };
  const to = resolveActionTarget(payload.toRef, payload.sid);
  if ('ok' in to) return { ...to, action: 'drag', ref: payload.toRef };

  const fromPoint = rectCenter(from.rect);
  const toPoint = rectCenter(to.rect);
  await showVirtualDrag(documentObject, fromPoint, toPoint);
  dispatchMouseEvent(from.element, 'mousedown', fromPoint);
  dispatchMouseEvent(to.element, 'mousemove', toPoint);
  dispatchMouseEvent(to.element, 'mouseup', toPoint);
  return { ok: true, action: 'drag', ref: payload.fromRef };
}

/**
 * Executes a mouse move action against one latest snapshot ref.
 *
 * @param payload - The action payload.
 * @param documentObject - The document to operate on.
 * @returns A structured mouse move action result.
 */
async function executeMouseMoveAction(
  payload: PageActionToolRequestPayload,
  documentObject: Document,
): Promise<PageActionToolResult> {
  const target = resolveActionTarget(payload.ref, payload.sid);
  if ('ok' in target) return { ...target, action: payload.action, ref: payload.ref };

  const point = rectCenter(target.rect);
  await showVirtualMouseMove(documentObject, point);
  dispatchMouseEvent(target.element, 'mousemove', point);
  return { ok: true, action: 'mouse_move', ref: payload.ref };
}

/**
 * Executes a click action against one latest snapshot ref.
 *
 * @param payload - The click action payload.
 * @param documentObject - The document to operate on.
 * @returns A structured click action result.
 */
async function executeClickAction(
  payload: PageActionToolRequestPayload,
  documentObject: Document,
): Promise<PageActionToolResult> {
  const target = resolveActionTarget(payload.ref, payload.sid);
  if ('ok' in target) return { ...target, action: payload.action, ref: payload.ref };

  const point = rectCenter(target.rect);
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

/**
 * Executes a type action against one latest snapshot ref.
 *
 * @param payload - The type action payload.
 * @param documentObject - The document to operate on.
 * @param windowObject - The window to operate on.
 * @returns A structured type action result.
 */
async function executeTypeAction(
  payload: PageActionToolRequestPayload,
  documentObject: Document,
  windowObject: Window,
): Promise<PageActionToolResult> {
  const target = resolveActionTarget(payload.ref, payload.sid);
  if ('ok' in target) return { ...target, action: payload.action, ref: payload.ref };

  const point = rectCenter(target.rect);
  const fallbackTextTarget = resolveTextTarget(target.element, windowObject);
  const focusedBeforeClick = readFocusedElement(documentObject);
  await showVirtualMouseMove(documentObject, point);
  dispatchMouseEvent(target.element, 'mousedown', point);
  dispatchMouseEvent(target.element, 'mouseup', point);
  dispatchMouseEvent(target.element, 'click', point);
  const focusedTextTarget = readFocusedElement(documentObject);
  const shouldPreferFocusedTarget = focusedTextTarget &&
    focusedTextTarget !== fallbackTextTarget &&
    focusedTextTarget !== focusedBeforeClick;
  const textTargets = shouldPreferFocusedTarget
    ? [focusedTextTarget, fallbackTextTarget]
    : [fallbackTextTarget];
  await showVirtualType(documentObject, target.rect);

  let writtenTarget: Element | undefined;
  let stateBefore = readElementState(textTargets[0]);
  for (const textTarget of textTargets) {
    stateBefore = readElementState(textTarget);
    if (writeText(textTarget, payload.text ?? '', payload.clear)) {
      writtenTarget = textTarget;
      break;
    }
  }

  if (!writtenTarget) {
    return { ok: false, action: 'type', ref: payload.ref, error: 'PAGE_ACTION_TARGET_NOT_TEXT_INPUT' };
  }
  const stateAfter = readElementState(writtenTarget);
  return {
    ok: true,
    action: 'type',
    ref: payload.ref,
    changed: didStateChange(stateBefore, stateAfter),
    ...(stateBefore ? { stateBefore } : {}),
    ...(stateAfter ? { stateAfter } : {}),
  };
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
    return executeScrollAction(payload, documentObject, windowObject);
  }
  if (payload.action === 'drag') {
    return executeDragAction(payload, documentObject);
  }
  if (payload.action === 'mouse_move') {
    return executeMouseMoveAction(payload, documentObject);
  }
  if (payload.action === 'click') {
    return executeClickAction(payload, documentObject);
  }
  if (payload.action === 'type') {
    return executeTypeAction(payload, documentObject, windowObject);
  }

  return { ok: false, action: payload.action, ref: payload.ref, error: 'PAGE_ACTION_UNSUPPORTED' };
}
