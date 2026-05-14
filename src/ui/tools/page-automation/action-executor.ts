import {
  type PageActionToolRequestPayload,
  type PageActionToolResult,
} from '../../../shared/types/tools';
import { isHiddenBySelfOrAncestor, resolveTextTarget } from './dom-targets';
import {
  canScrollElement,
  findScrollableAncestor,
  findScrollableElement,
  scrollElement,
  scrollPageOrContainer,
  scrollWindow,
} from './action-scroll';
import { didStateChange, readElementState, resolveStateElement } from './action-state';
import { readFocusedElement, type ResolvedActionTarget, resolveActionTarget } from './action-targets';
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
 * @param buttons - Mouse buttons state for the event.
 * @param bubbles - Whether the event bubbles.
 */
function dispatchMouseEvent(
  element: Element,
  type: string,
  point: ViewportPoint,
  buttons = type === 'mousedown' ? 1 : 0,
  bubbles = true,
): void {
  element.dispatchEvent(new MouseEvent(type, {
    bubbles,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    buttons,
  }));
}

/**
 * Dispatches a pointer-compatible event on an element.
 *
 * @param element - The event target.
 * @param type - The pointer event type.
 * @param point - The viewport point.
 * @param documentObject - The document that owns the event target.
 * @param buttons - Pointer buttons state for the event.
 */
function dispatchPointerEvent(
  element: Element,
  type: string,
  point: ViewportPoint,
  documentObject: Document,
  buttons = type === 'pointerdown' ? 1 : 0,
): void {
  const windowObject = documentObject.defaultView ?? window;
  const PointerEventConstructor = windowObject.PointerEvent ?? windowObject.MouseEvent;
  element.dispatchEvent(new PointerEventConstructor(type, {
    bubbles: true,
    cancelable: true,
    clientX: point.x,
    clientY: point.y,
    buttons,
  }));
}

/**
 * Dispatches hover entry events before click or mouse-move actions.
 *
 * @param element - The element that receives the hover sequence.
 * @param point - The viewport point.
 * @param documentObject - The document that owns the event target.
 * @param surfaceElement - Optional ref surface that should receive ancestor enter events.
 */
function dispatchHoverSequence(element: Element, point: ViewportPoint, documentObject: Document, surfaceElement: Element = element): void {
  dispatchPointerEvent(element, 'pointerover', point, documentObject);
  dispatchPointerEvent(element, 'pointerenter', point, documentObject);
  dispatchMouseEvent(element, 'mouseover', point);
  dispatchMouseEvent(element, 'mouseenter', point, 0, false);
  if (surfaceElement !== element) {
    dispatchPointerEvent(surfaceElement, 'pointerenter', point, documentObject);
    dispatchMouseEvent(surfaceElement, 'mouseenter', point, 0, false);
  }
  dispatchPointerEvent(element, 'pointermove', point, documentObject);
  dispatchMouseEvent(element, 'mousemove', point);
}

/**
 * Focuses a target before a synthetic click so composite pickers observe browser-like focus.
 *
 * @param element - The element that will receive the click sequence.
 */
function focusBeforeClick(element: Element): void {
  if (!(element instanceof HTMLElement)) return;
  element.focus({ preventScroll: true });
}

/**
 * Chooses the deepest visible DOM target at a snapshot point while staying inside the ref surface.
 *
 * @param surfaceElement - The snapshot element selected by ref.
 * @param point - The viewport point used for the action.
 * @param documentObject - The document being operated on.
 * @returns The hit-tested descendant when available, otherwise the snapshot element.
 */
function resolveDispatchTarget(surfaceElement: Element, point: ViewportPoint, documentObject: Document): Element {
  const hitElement = documentObject.elementFromPoint(point.x, point.y);
  return hitElement && surfaceElement.contains(hitElement) ? hitElement : surfaceElement;
}

/**
 * Chooses the element that should receive focus before a click sequence.
 *
 * @param surfaceElement - The snapshot element selected by ref.
 * @param dispatchTarget - The actual event target at the click point.
 * @returns The focus target that best matches browser click behavior.
 */
function resolveFocusTarget(surfaceElement: Element, dispatchTarget: Element): Element {
  if (surfaceElement instanceof HTMLElement && surfaceElement.tabIndex >= 0) return surfaceElement;
  return dispatchTarget;
}

/**
 * Checks whether overflow style clips descendants along an axis.
 *
 * @param overflow - The computed overflow value.
 * @returns True when descendants outside the ancestor rect are not visible.
 */
function clipsOverflow(overflow: string): boolean {
  return overflow !== 'visible';
}

/**
 * Reads target bounds clipped by viewport and scrollable or hidden ancestors.
 *
 * @param element - The action target element.
 * @param rect - The target rectangle from the latest snapshot.
 * @param windowObject - The window that owns the element.
 * @returns A visible bounds object when any target area remains visible.
 */
function readVisibleActionBounds(
  element: Element,
  rect: DOMRect,
  windowObject: Window,
): { left: number; top: number; right: number; bottom: number } {
  const bounds = {
    left: Math.max(rect.left, 0),
    top: Math.max(rect.top, 0),
    right: Math.min(rect.right, windowObject.innerWidth),
    bottom: Math.min(rect.bottom, windowObject.innerHeight),
  };

  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    const style = windowObject.getComputedStyle(ancestor);
    const ancestorRect = ancestor.getBoundingClientRect();
    if (clipsOverflow(style.overflowX)) {
      bounds.left = Math.max(bounds.left, ancestorRect.left);
      bounds.right = Math.min(bounds.right, ancestorRect.right);
    }
    if (clipsOverflow(style.overflowY)) {
      bounds.top = Math.max(bounds.top, ancestorRect.top);
      bounds.bottom = Math.min(bounds.bottom, ancestorRect.bottom);
    }
  }

  if (bounds.right <= bounds.left || bounds.bottom <= bounds.top) {
    return {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
    };
  }

  return bounds;
}

/**
 * Converts visible bounds to a viewport point.
 *
 * @param bounds - The visible bounds to sample.
 * @returns A center point inside those bounds.
 */
function boundsCenter(bounds: { left: number; top: number; right: number; bottom: number }): ViewportPoint {
  return {
    x: bounds.left + (bounds.right - bounds.left) / 2,
    y: bounds.top + (bounds.bottom - bounds.top) / 2,
  };
}

/**
 * Checks whether a viewport point hit-tests inside a target surface.
 *
 * @param surfaceElement - The snapshot element selected by ref.
 * @param point - The viewport point to test.
 * @param documentObject - The document used for hit testing.
 * @returns True when browser hit testing lands on the surface or one of its descendants.
 */
function hitsSurfaceAtPoint(surfaceElement: Element, point: ViewportPoint, documentObject: Document): boolean {
  const hitElement = documentObject.elementFromPoint(point.x, point.y);
  return Boolean(hitElement && (hitElement === surfaceElement || surfaceElement.contains(hitElement)));
}

/**
 * Chooses a viewport point that is inside the visible portion of the target.
 *
 * @param surfaceElement - The snapshot element selected by ref.
 * @param rect - The target rectangle from the latest snapshot.
 * @param documentObject - The document used for hit testing.
 * @param windowObject - The window that owns the document.
 * @returns A point suitable for human-like hover or click events.
 */
function resolveActionPoint(
  surfaceElement: Element,
  rect: DOMRect,
  documentObject: Document,
  windowObject: Window,
): ViewportPoint {
  const visibleBounds = readVisibleActionBounds(surfaceElement, rect, windowObject);
  const centerPoint = boundsCenter(visibleBounds);
  if (hitsSurfaceAtPoint(surfaceElement, centerPoint, documentObject)) return centerPoint;

  const xRatios = [0.5, 0.25, 0.75, 0.1, 0.9];
  const yRatios = [0.5, 0.25, 0.75, 0.1, 0.9];
  for (const yRatio of yRatios) {
    for (const xRatio of xRatios) {
      const point = {
        x: visibleBounds.left + (visibleBounds.right - visibleBounds.left) * xRatio,
        y: visibleBounds.top + (visibleBounds.bottom - visibleBounds.top) * yRatio,
      };
      if (hitsSurfaceAtPoint(surfaceElement, point, documentObject)) return point;
    }
  }

  return centerPoint;
}

/**
 * Builds a structured error when an action targets a non-operable snapshot item.
 *
 * @param target - The resolved snapshot target.
 * @param action - The requested action name.
 * @param ref - The snapshot ref supplied by the model.
 * @returns An error result when the target cannot receive the action.
 */
function rejectNonOperableTarget(
  target: ResolvedActionTarget,
  action: PageActionToolRequestPayload['action'],
  ref: string | undefined,
): PageActionToolResult | undefined {
  return target.canOperate === true
    ? undefined
    : { ok: false, action, ref, error: 'PAGE_ACTION_TARGET_NOT_OPERABLE' };
}

/**
 * Checks whether a target became unavailable after an action.
 *
 * @param element - The action target element.
 * @param windowObject - The window that owns the element.
 * @returns True when the target was removed, hidden, or collapsed.
 */
function isTargetUnavailable(element: Element, windowObject: Window): boolean {
  if (!element.isConnected) return true;

  const rect = element.getBoundingClientRect();
  return rect.width < 2 || rect.height < 2 || isHiddenBySelfOrAncestor(element, windowObject);
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
  windowObject: Window,
): Promise<PageActionToolResult> {
  const from = resolveActionTarget(payload.fromRef, payload.sid);
  if ('ok' in from) return { ...from, action: 'drag', ref: payload.fromRef };
  const to = resolveActionTarget(payload.toRef, payload.sid);
  if ('ok' in to) return { ...to, action: 'drag', ref: payload.toRef };
  const fromOperableError = rejectNonOperableTarget(from, 'drag', payload.fromRef);
  if (fromOperableError) return fromOperableError;
  const toOperableError = rejectNonOperableTarget(to, 'drag', payload.toRef);
  if (toOperableError) return toOperableError;

  const fromPoint = resolveActionPoint(from.element, from.rect, documentObject, windowObject);
  const toPoint = resolveActionPoint(to.element, to.rect, documentObject, windowObject);
  await showVirtualDrag(documentObject, fromPoint, toPoint);
  dispatchMouseEvent(from.element, 'mousedown', fromPoint);
  dispatchMouseEvent(to.element, 'mousemove', toPoint, 1);
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
  windowObject: Window,
): Promise<PageActionToolResult> {
  const target = resolveActionTarget(payload.ref, payload.sid);
  if ('ok' in target) return { ...target, action: payload.action, ref: payload.ref };
  const operableError = rejectNonOperableTarget(target, 'mouse_move', payload.ref);
  if (operableError) return operableError;

  const point = resolveActionPoint(target.element, target.rect, documentObject, windowObject);
  const dispatchTarget = resolveDispatchTarget(target.element, point, documentObject);
  await showVirtualMouseMove(documentObject, point);
  dispatchHoverSequence(dispatchTarget, point, documentObject, target.element);
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
  windowObject: Window,
): Promise<PageActionToolResult> {
  const target = resolveActionTarget(payload.ref, payload.sid);
  if ('ok' in target) return { ...target, action: payload.action, ref: payload.ref };
  const operableError = rejectNonOperableTarget(target, 'click', payload.ref);
  if (operableError) return operableError;

  const point = resolveActionPoint(target.element, target.rect, documentObject, windowObject);
  const stateElement = resolveStateElement(target.element);
  const stateBefore = readElementState(stateElement);
  const targetWasConnected = target.element.isConnected;
  const dispatchTarget = resolveDispatchTarget(target.element, point, documentObject);
  const focusTarget = resolveFocusTarget(target.element, dispatchTarget);
  await showVirtualClickTarget(documentObject, point);
  dispatchHoverSequence(dispatchTarget, point, documentObject, target.element);
  focusBeforeClick(focusTarget);
  dispatchPointerEvent(dispatchTarget, 'pointerdown', point, documentObject);
  dispatchMouseEvent(dispatchTarget, 'mousedown', point);
  dispatchPointerEvent(dispatchTarget, 'pointerup', point, documentObject);
  dispatchMouseEvent(dispatchTarget, 'mouseup', point);
  dispatchMouseEvent(dispatchTarget, 'click', point);
  await showVirtualClickFeedback(documentObject, point);
  const stateAfter = readElementState(stateElement);
  const targetBecameUnavailable = targetWasConnected && isTargetUnavailable(target.element, windowObject);
  return {
    ok: true,
    action: 'click',
    ref: payload.ref,
    changed: didStateChange(stateBefore, stateAfter) || targetBecameUnavailable,
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
    return executeDragAction(payload, documentObject, windowObject);
  }
  if (payload.action === 'mouse_move') {
    return executeMouseMoveAction(payload, documentObject, windowObject);
  }
  if (payload.action === 'click') {
    return executeClickAction(payload, documentObject, windowObject);
  }
  if (payload.action === 'type') {
    return executeTypeAction(payload, documentObject, windowObject);
  }

  return { ok: false, action: payload.action, ref: payload.ref, error: 'PAGE_ACTION_UNSUPPORTED' };
}
