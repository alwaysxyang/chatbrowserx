import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { translateMessage } from '../../../shared/i18n/i18n';
import {
  captureSelectedViewport,
  createDefaultScreenshotSelection,
  waitForScreenshotFrame,
  type ScreenshotRect,
} from './screenshot-capture';
import {
  cursorForEdge,
  getResizeEdge,
  isInsideSelection,
  moveSelection,
  resizeSelection,
  toSelection,
  type ResizeEdge,
} from './screenshot-selection-geometry';
import { useLongScreenshotSession } from './use-long-screenshot-session';

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

function isControlsTarget(target: EventTarget): boolean {
  return target instanceof Element && !!target.closest('.screenshot-controls');
}

export function ScreenshotOverlay({ onCaptureVisibleTab, onComplete, onCancel }: ScreenshotOverlayProps) {
  const [selection, setSelection] = useState<ScreenshotRect>(() => createDefaultScreenshotSelection());
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [cursor, setCursor] = useState<CSSProperties['cursor']>('crosshair');
  const isCapturingRef = useRef(false);
  const interactionStateRef = useRef<InteractionState | null>(null);
  const {
    isLongMode,
    isLongModeRef,
    completeLongCapture,
    queueWheelCapture,
    resetLongMode,
    startLongMode,
    stopLongModeQueue,
  } = useLongScreenshotSession({ onCaptureVisibleTab });
  const controlsStyle = useMemo(() => {
    const top = Math.min(selection.top + selection.height + 10, Math.max(8, window.innerHeight - 44));
    const left = selection.left + selection.width / 2;

    return {
      left: `${left}px`,
      top: `${top}px`,
      transform: 'translateX(-50%)',
    };
  }, [selection]);

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

  const runWithHiddenOverlay = async <T,>(capture: () => Promise<T>): Promise<T | undefined> => {
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
  };

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

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!isLongModeRef.current || !isLongMode || !isInsideSelection(event.clientX, event.clientY, selection)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    queueWheelCapture(selection, event.deltaX, event.deltaY);
  };

  const completeLongScreenshotAndFinish = async () => {
    if (isLongModeRef.current) {
      stopLongModeQueue();
    }

    const dataUrl =
      (await completeLongCapture()) ??
      (await runWithHiddenOverlay(() => captureSelectedViewport(onCaptureVisibleTab, selection)));

    if (typeof dataUrl === 'string') {
      onComplete(dataUrl);
    }
  };

  return (
    <div
      className={`screenshot-overlay ${isCapturing ? 'screenshot-overlay-capturing' : ''}`}
      data-testid="screenshot-overlay"
      style={{ cursor, background: 'transparent' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onWheel={handleWheel}
    >
      <div
        className="screenshot-selection"
        data-testid="screenshot-selection"
        style={{ ...selection, background: 'transparent', border: 0, outlineColor: '#ffffff' }}
        aria-hidden="true"
      />
      <div className="screenshot-controls" data-testid="screenshot-controls" style={controlsStyle}>
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

            startLongMode(selection);
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
