import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent, WheelEvent as ReactWheelEvent } from 'react';
import { translateMessage } from '../../../shared/i18n/i18n';
import {
  captureLongScreenshotSegments,
  captureSelectedViewport,
  createDefaultScreenshotSelection,
  getScreenshotDocumentRange,
  getUncapturedLongScreenshotSegments,
  stitchLongScreenshotChunks,
  waitForScreenshotFrame,
  type CapturedLongScreenshotChunk,
  type ScreenshotRect,
} from './screenshot-capture';

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

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

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

const minSelectionSize = 24;
const resizeThreshold = 8;

function toSelection(startX: number, startY: number, endX: number, endY: number): ScreenshotRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.max(minSelectionSize, Math.abs(endX - startX));
  const height = Math.max(minSelectionSize, Math.abs(endY - startY));

  return { left, top, width, height };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function getViewportSize() {
  return {
    width: Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1),
    height: Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1),
  };
}

function isInsideSelection(x: number, y: number, selection: ScreenshotRect): boolean {
  return (
    x >= selection.left &&
    x <= selection.left + selection.width &&
    y >= selection.top &&
    y <= selection.top + selection.height
  );
}

function getResizeEdge(x: number, y: number, selection: ScreenshotRect): ResizeEdge | null {
  if (!isInsideSelection(x, y, selection)) {
    return null;
  }

  const isNearLeft = Math.abs(x - selection.left) <= resizeThreshold;
  const isNearRight = Math.abs(x - (selection.left + selection.width)) <= resizeThreshold;
  const isNearTop = Math.abs(y - selection.top) <= resizeThreshold;
  const isNearBottom = Math.abs(y - (selection.top + selection.height)) <= resizeThreshold;
  const horizontal = isNearLeft ? 'w' : isNearRight ? 'e' : '';
  const vertical = isNearTop ? 'n' : isNearBottom ? 's' : '';

  return (vertical || horizontal ? `${vertical}${horizontal}` : null) as ResizeEdge | null;
}

function cursorForEdge(edge: ResizeEdge | null): CSSProperties['cursor'] | null {
  if (!edge) {
    return null;
  }

  if (edge === 'n' || edge === 's') return 'ns-resize';
  if (edge === 'e' || edge === 'w') return 'ew-resize';
  if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

function moveSelection(selection: ScreenshotRect, dx: number, dy: number): ScreenshotRect {
  const viewport = getViewportSize();
  const width = Math.min(selection.width, viewport.width);
  const height = Math.min(selection.height, viewport.height);

  return {
    left: clamp(selection.left + dx, 0, Math.max(0, viewport.width - width)),
    top: clamp(selection.top + dy, 0, Math.max(0, viewport.height - height)),
    width,
    height,
  };
}

function resizeSelection(
  selection: ScreenshotRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
): ScreenshotRect {
  const viewport = getViewportSize();
  let { left, top, width, height } = selection;

  if (edge.includes('e')) {
    width += dx;
  }

  if (edge.includes('s')) {
    height += dy;
  }

  if (edge.includes('w')) {
    left += dx;
    width -= dx;
  }

  if (edge.includes('n')) {
    top += dy;
    height -= dy;
  }

  if (width < minSelectionSize) {
    if (edge.includes('w')) {
      left = selection.left + selection.width - minSelectionSize;
    }
    width = minSelectionSize;
  }

  if (height < minSelectionSize) {
    if (edge.includes('n')) {
      top = selection.top + selection.height - minSelectionSize;
    }
    height = minSelectionSize;
  }

  if (left < 0) {
    width += left;
    left = 0;
  }

  if (top < 0) {
    height += top;
    top = 0;
  }

  width = clamp(width, minSelectionSize, Math.max(minSelectionSize, viewport.width - left));
  height = clamp(height, minSelectionSize, Math.max(minSelectionSize, viewport.height - top));

  return { left, top, width, height };
}

function isControlsTarget(target: EventTarget): boolean {
  return target instanceof Element && !!target.closest('.screenshot-controls');
}

export function ScreenshotOverlay({ onCaptureVisibleTab, onComplete, onCancel }: ScreenshotOverlayProps) {
  const [selection, setSelection] = useState<ScreenshotRect>(() => createDefaultScreenshotSelection());
  const [interactionState, setInteractionState] = useState<InteractionState | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isLongMode, setIsLongMode] = useState(false);
  const [cursor, setCursor] = useState<CSSProperties['cursor']>('crosshair');
  const isCapturingRef = useRef(false);
  const interactionStateRef = useRef<InteractionState | null>(null);
  const longChunksRef = useRef<CapturedLongScreenshotChunk[]>([]);
  const longCapturePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const longModeRunIdRef = useRef(0);
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

  const resetLongMode = () => {
    longModeRunIdRef.current += 1;
    setIsLongMode(false);
    longChunksRef.current = [];
    longCapturePromiseRef.current = Promise.resolve();
  };

  const updateInteractionState = (nextState: InteractionState | null) => {
    interactionStateRef.current = nextState;
    setInteractionState(nextState);
  };

  const captureLongSelectionChunks = (currentSelection: ScreenshotRect, runId: number) => {
    const captureTask = async () => {
      if (longModeRunIdRef.current !== runId) {
        return;
      }

      const segments = getUncapturedLongScreenshotSegments(
        getScreenshotDocumentRange(currentSelection),
        longChunksRef.current,
      );

      if (!segments.length) {
        return;
      }

      const chunks = await runWithHiddenOverlay(() =>
        captureLongScreenshotSegments(onCaptureVisibleTab, currentSelection, segments),
      );

      if (!chunks?.length || longModeRunIdRef.current !== runId) {
        return;
      }

      longChunksRef.current = [...longChunksRef.current, ...chunks].sort((left, right) => left.startY - right.startY);
    };

    const nextCapture = longCapturePromiseRef.current.then(captureTask, captureTask);
    longCapturePromiseRef.current = nextCapture.then(
      () => undefined,
      () => undefined,
    );
    void longCapturePromiseRef.current;
  };

  const startLongMode = () => {
    longModeRunIdRef.current += 1;
    const runId = longModeRunIdRef.current;
    longChunksRef.current = [];
    setIsLongMode(true);
    captureLongSelectionChunks(selection, runId);
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
    if (!isLongMode || isCapturingRef.current || !isInsideSelection(event.clientX, event.clientY, selection)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentSelection = selection;
    const deltaX = event.deltaX;
    const deltaY = event.deltaY;
    const runId = longModeRunIdRef.current;

    void (async () => {
      if (typeof window.scrollBy === 'function') {
        window.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
      } else {
        window.scrollTo(window.scrollX + deltaX, window.scrollY + deltaY);
      }
      await waitForScreenshotFrame();
      captureLongSelectionChunks(currentSelection, runId);
    })();
  };

  const completeLongScreenshot = async () => {
    await longCapturePromiseRef.current;

    if (!longChunksRef.current.length) {
      return runWithHiddenOverlay(() => captureSelectedViewport(onCaptureVisibleTab, selection));
    }

    return stitchLongScreenshotChunks(longChunksRef.current);
  };

  const completeLongScreenshotAndFinish = async () => {
    const dataUrl = await completeLongScreenshot();

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
        style={{ ...selection, background: 'transparent', borderColor: '#ffffff' }}
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

            startLongMode();
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
