import { useRef, useState } from 'react';
import type { CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
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
import { isScreenshotControlsTarget } from './ScreenshotControls';

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

export type ScreenshotInteractionState = DragState | MoveState | ResizeState;

interface UseScreenshotInteractionOptions {
  selection: ScreenshotRect;
  setSelection: (selection: ScreenshotRect) => void;
  onInteractionStart: () => void;
}

/**
 * Coordinates screenshot selection drawing, moving, resizing, and cursor state.
 *
 * @param options - Current selection state and lifecycle hooks.
 * @returns Pointer handlers and interaction state consumed by the overlay shell.
 */
export function useScreenshotInteraction({ selection, setSelection, onInteractionStart }: UseScreenshotInteractionOptions) {
  const [interactionState, setInteractionState] = useState<ScreenshotInteractionState | null>(null);
  const [cursor, setCursor] = useState<CSSProperties['cursor']>('crosshair');
  const interactionStateRef = useRef<ScreenshotInteractionState | null>(null);

  /**
   * Updates interaction state in both React state and the synchronous event ref.
   *
   * @param nextState - The next active interaction state.
   */
  const updateInteractionState = (nextState: ScreenshotInteractionState | null) => {
    interactionStateRef.current = nextState;
    setInteractionState(nextState);
  };

  /**
   * Starts drawing, moving, or resizing the selection based on the pointer location.
   *
   * @param event - Pointer down event from the overlay shell.
   */
  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.button !== 0 && event.button !== undefined) || isScreenshotControlsTarget(event.target)) {
      return;
    }

    onInteractionStart();

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

  /**
   * Updates the active selection interaction or hover cursor.
   *
   * @param event - Pointer move event from the overlay shell.
   */
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

  /**
   * Ends the active selection interaction and releases pointer capture.
   *
   * @param event - Pointer up event from the overlay shell.
   */
  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateInteractionState(null);
    setCursor(cursorForEdge(getResizeEdge(event.clientX, event.clientY, selection)) ?? 'crosshair');

    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }
  };

  return {
    cursor,
    interactionState,
    interactionStateRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  };
}
