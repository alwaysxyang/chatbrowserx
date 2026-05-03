import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import { translateMessage } from '../../../shared/i18n/i18n';
import {
  captureSelectedViewport,
  createDefaultScreenshotSelection,
} from './screenshot/screenshot-capture';
import { waitForScreenshotFrame } from './screenshot/screenshot-frame';
import {
  resolveScreenshotScrollTargetAtPoint,
  scrollScreenshotTarget,
} from './screenshot/screenshot-scroll-target';
import {
  cursorForEdge,
  getResizeEdge,
  isInsideSelection,
  moveSelection,
  resizeSelection,
  toSelection,
  type ResizeEdge,
} from './screenshot/screenshot-selection-geometry';
import type { ScreenshotRect } from './screenshot/screenshot-types';
import { useLongScreenshotSession } from './screenshot/use-long-screenshot-session';

interface ScreenshotOverlayProps {
  onCaptureVisibleTab: () => Promise<string>;
  onComplete: (dataUrl: string) => void;
  onCancel: () => void;
}

interface DragState {
  type: 'draw';
  startX: number;
  startY: number;
}

interface MoveState {
  type: 'move';
  startX: number;
  startY: number;
  startSelection: ScreenshotRect;
}

interface ResizeState {
  type: 'resize';
  startX: number;
  startY: number;
  startSelection: ScreenshotRect;
  edge: ResizeEdge;
}

type InteractionState = DragState | MoveState | ResizeState;

/**
 * Check whether the event target belongs to the screenshot control area.
 *
 * @param target - The original event target
 * @returns True when the target is inside the control container
 */
function isControlsTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('.screenshot-controls');
}

/**
 * Check whether an element visually intersects the current screenshot selection.
 *
 * @param element - The candidate scrolling element
 * @param selection - The active screenshot selection
 * @returns True when the element overlaps the selection rectangle
 */
function doesSelectionIntersectElement(element: Element, selection: ScreenshotRect): boolean {
  const rect = element.getBoundingClientRect();
  const selectionRect = new DOMRect(selection.left, selection.top, selection.width, selection.height);

  return !(
    rect.right < selectionRect.left ||
    rect.left > selectionRect.right ||
    rect.bottom < selectionRect.top ||
    rect.top > selectionRect.bottom
  );
}

/**
 * Build the floating controls position for the current selection.
 *
 * @param selection - The active screenshot selection
 * @param viewportHeight - Current viewport height
 * @returns CSS properties that center controls above or below the selection
 */
function buildControlsStyle(selection: ScreenshotRect, viewportHeight: number): CSSProperties {
  const controlsHeight = 36;
  const topOffset = 10;
  const belowTop = selection.top + selection.height + topOffset;
  const aboveTop = selection.top - controlsHeight - topOffset;
  const top = belowTop <= viewportHeight - 44
    ? belowTop
    : Math.max(8, aboveTop);
  const left = selection.left + selection.width / 2;

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'translateX(-50%)',
  };
}

/**
 * Return the center point of a screenshot selection.
 *
 * @param selection - The active screenshot selection
 * @returns The viewport point at the center of the selection
 */
function getSelectionCenter(selection: ScreenshotRect): { x: number; y: number } {
  return {
    x: selection.left + selection.width / 2,
    y: selection.top + selection.height / 2,
  };
}

/**
 * Check whether a scroll event target represents the document-level scroll surface.
 *
 * @param target - The scroll event target
 * @returns True when the target is the window or document scrolling surface
 */
function isRootScrollTarget(target: EventTarget | null): boolean {
  return (
    target === document ||
    target === window ||
    target === document.documentElement ||
    target instanceof Window ||
    target === document.body
  );
}

export function ScreenshotOverlay({ onCaptureVisibleTab, onComplete, onCancel }: ScreenshotOverlayProps) {
  const [selection, setSelection] = useState<ScreenshotRect>(() => createDefaultScreenshotSelection());
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cursor, setCursor] = useState<CSSProperties['cursor']>('crosshair');
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const isCapturingRef = useRef(false);
  const interactionStateRef = useRef<InteractionState | null>(null);
  const selectionRef = useRef(selection);

  selectionRef.current = selection;

  /**
   * Capture the current tab while the screenshot overlay UI is temporarily hidden.
   *
   * @param capture - The capture callback to run once the overlay is hidden
   * @returns The capture result, or `undefined` when another capture is already in flight
   */
  async function runWithHiddenOverlay<T>(capture: () => Promise<T>): Promise<T | undefined> {
    if (isCapturingRef.current) {
      return undefined;
    }

    isCapturingRef.current = true;
    setIsCapturing(true);
    await waitForScreenshotFrame();

    try {
      return await capture();
    } finally {
      isCapturingRef.current = false;
      setIsCapturing(false);
    }
  }

  /**
   * Capture the current visible tab for long-screenshot chunking without including
   * the screenshot overlay controls in the frame.
   *
   * @returns The captured tab image as a data URL
   */
  async function captureVisibleTabWithoutOverlay(): Promise<string> {
    const dataUrl = await runWithHiddenOverlay(onCaptureVisibleTab);

    if (typeof dataUrl !== 'string') {
      throw new Error('Screenshot capture did not produce an image.');
    }

    return dataUrl;
  }

  /**
   * Hide the floating screenshot controls for one capture cycle without re-rendering the
   * full overlay. This keeps long-screenshot chunk captures visually stable.
   *
   * @param capture - The capture callback to run while controls are hidden
   * @returns The capture result
   */
  async function runWithHiddenControls<T>(capture: () => Promise<T>): Promise<T> {
    const controlsElement = controlsRef.current;

    if (!controlsElement) {
      return capture();
    }

    const previousVisibility = controlsElement.style.visibility;
    controlsElement.style.visibility = 'hidden';
    await waitForScreenshotFrame();

    try {
      return await capture();
    } finally {
      controlsElement.style.visibility = previousVisibility;
    }
  }

  /**
   * Capture the current tab for long-screenshot chunking. The selection outline can stay
   * visible because it sits outside the cropped rectangle, but overlapping controls must be hidden.
   *
   * @returns The captured tab image as a data URL
   */
  async function captureVisibleTabForLongMode(): Promise<string> {
    const controlsElement = controlsRef.current;

    if (
      controlsElement
      && doesSelectionIntersectElement(controlsElement, selectionRef.current)
    ) {
      return runWithHiddenControls(onCaptureVisibleTab);
    }

    return onCaptureVisibleTab();
  }

  const {
    isLongMode,
    isLongModeRef,
    completeLongCapture,
    queueWheelCapture,
    resetLongMode,
    startLongMode,
    stopLongModeQueue,
  } = useLongScreenshotSession({ onCaptureVisibleTab: captureVisibleTabForLongMode });
  const controlsStyle = useMemo(() => buildControlsStyle(selection, window.innerHeight), [selection]);

  /**
   * Return the shadow host used to mount the content app, so hit testing can skip it.
   *
   * @returns The host elements that should be ignored during screenshot hit testing
   */
  const getIgnoredHitTestElements = () => {
    const rootNode = overlayRef.current?.getRootNode();

    if (rootNode instanceof ShadowRoot) {
      return [rootNode.host];
    }

    return [];
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  /**
   * Forward wheel scrolling inside the selection and queue long-screenshot captures
   * when the active scroll target changes.
   */
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (isControlsTarget(event.target)) {
        return;
      }

      if (interactionStateRef.current) {
        return;
      }

      if (!isLongModeRef.current && isCapturingRef.current) {
        return;
      }

      if (!isInsideSelection(event.clientX, event.clientY, selection)) {
        return;
      }

      const scrollTarget = resolveScreenshotScrollTargetAtPoint(
        event.clientX,
        event.clientY,
        getIgnoredHitTestElements(),
      );

      event.preventDefault();

      if (isLongModeRef.current) {
        scrollScreenshotTarget(scrollTarget, event.deltaX, event.deltaY);
        queueWheelCapture(selection);
        return;
      }

      scrollScreenshotTarget(scrollTarget, event.deltaX, event.deltaY);
    };

    const handleScroll = (event: Event) => {
      if (!isLongModeRef.current) {
        return;
      }

      const scrollTarget = event.target;

      if (isRootScrollTarget(scrollTarget)) {
        queueWheelCapture(selection);
        return;
      }

      if (scrollTarget instanceof Element && doesSelectionIntersectElement(scrollTarget, selection)) {
        queueWheelCapture(selection);
      }
    };

    window.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, true);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [isLongModeRef, queueWheelCapture, selection]);

  const runCapture = async (capture: () => Promise<string>) => {
    const dataUrl = await runWithHiddenOverlay(capture);

    if (typeof dataUrl === 'string') {
      onComplete(dataUrl);
    }
  };

  const updateInteractionState = (nextState: InteractionState | null) => {
    interactionStateRef.current = nextState;
    setInteractionState(nextState);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.button !== 0 && event.button !== undefined) || isControlsTarget(event.target)) {
      return;
    }

    resetLongMode();

    const resizeEdge = getResizeEdge(event.clientX, event.clientY, selection);

    if (resizeEdge) {
      updateInteractionState({
        type: 'resize',
        startX: event.clientX,
        startY: event.clientY,
        startSelection: selection,
        edge: resizeEdge,
      });
      setCursor(cursorForEdge(resizeEdge) ?? 'crosshair');
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }

    if (isInsideSelection(event.clientX, event.clientY, selection)) {
      updateInteractionState({
        type: 'move',
        startX: event.clientX,
        startY: event.clientY,
        startSelection: selection,
      });
      setCursor('grabbing');
      event.currentTarget.setPointerCapture?.(event.pointerId);
      return;
    }

    updateInteractionState({ type: 'draw', startX: event.clientX, startY: event.clientY });
    setSelection(toSelection(event.clientX, event.clientY, event.clientX, event.clientY));
    setCursor('crosshair');
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentInteraction = interactionStateRef.current ?? interactionState;

    if (!currentInteraction) {
      const nextCursor = cursorForEdge(getResizeEdge(event.clientX, event.clientY, selection));
      setCursor(nextCursor ?? (isInsideSelection(event.clientX, event.clientY, selection) ? 'grab' : 'crosshair'));
      return;
    }

    if (currentInteraction.type === 'draw') {
      setSelection(toSelection(currentInteraction.startX, currentInteraction.startY, event.clientX, event.clientY));
      return;
    }

    if (currentInteraction.type === 'move') {
      setSelection(
        moveSelection(
          currentInteraction.startSelection,
          event.clientX - currentInteraction.startX,
          event.clientY - currentInteraction.startY,
        ),
      );
      return;
    }

    setSelection(
      resizeSelection(
        currentInteraction.startSelection,
        currentInteraction.edge,
        event.clientX - currentInteraction.startX,
        event.clientY - currentInteraction.startY,
      ),
    );
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateInteractionState(null);
    setCursor(cursorForEdge(getResizeEdge(event.clientX, event.clientY, selection)) ?? 'crosshair');

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  const completeLongScreenshotAndFinish = async () => {
    const wasLongMode = isLongModeRef.current;
    const dataUrl = wasLongMode
      ? await completeLongCapture(selection)
      : await runWithHiddenOverlay(() => captureSelectedViewport(onCaptureVisibleTab, selection));

    if (wasLongMode) {
      stopLongModeQueue();
    }

    if (typeof dataUrl === 'string') {
      onComplete(dataUrl);
    }
  };

  return (
    <div
      ref={overlayRef}
      className={`screenshot-overlay ${isCapturing ? 'screenshot-overlay-capturing' : ''} ${isLongMode ? 'screenshot-overlay-long-mode' : ''} ${interactionState ? 'screenshot-overlay-interacting' : ''}`}
      data-testid="screenshot-overlay"
      style={{ cursor, background: 'transparent' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <div
        className="screenshot-selection"
        data-testid="screenshot-selection"
        style={{ ...selection, background: 'transparent', border: 0, outlineColor: '#ffffff' }}
        aria-hidden="true"
      />
      <div
        ref={controlsRef}
        className="screenshot-controls"
        data-testid="screenshot-controls"
        style={controlsStyle}
      >
        <button
          type="button"
          className="screenshot-control-button"
          disabled={isCapturing}
          onClick={() => {
            void runCapture(onCaptureVisibleTab);
          }}
        >
          {translateMessage('chat.screenshot.fullscreen')}
        </button>
        <button
          type="button"
          className={`screenshot-control-button ${isLongMode ? 'screenshot-control-button-active' : ''}`}
          aria-pressed={isLongMode}
          disabled={isCapturing}
          onClick={() => {
            if (isLongMode) {
              resetLongMode();
              return;
            }

            const center = getSelectionCenter(selection);

            startLongMode(
              selection,
              resolveScreenshotScrollTargetAtPoint(center.x, center.y, getIgnoredHitTestElements()),
            );
          }}
        >
          {isLongMode ? translateMessage('chat.screenshot.cancelLong') : translateMessage('chat.screenshot.long')}
        </button>
        <button
          type="button"
          className="screenshot-control-button screenshot-control-button-done"
          disabled={isCapturing}
          onClick={() => {
            if (isLongMode) {
              void completeLongScreenshotAndFinish();
              return;
            }

            void runCapture(() => captureSelectedViewport(onCaptureVisibleTab, selection));
          }}
        >
          {translateMessage('chat.screenshot.done')}
        </button>
      </div>
    </div>
  );
}
