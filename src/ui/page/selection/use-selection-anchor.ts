import { useCallback, useEffect, useRef, useState } from 'react';
import {
  computeSelectionAnchor,
  getPointerDistance,
  isEventInsideBubble,
  readSelectionSnapshot,
  type BubbleAnchor,
  type PointerPoint,
} from './selection-anchor';

interface UseSelectionAnchorOptions {
  isPanelOpen: boolean;
  onBeforeSelectionChange: () => void;
}

const clickMovementThreshold = 4;

/**
 * Coordinates page selection detection, bubble anchoring, and outside-click hiding.
 *
 * @param options - Selection lifecycle callbacks and panel state.
 * @returns Selection text, anchor state, and the root ref consumed by the bubble.
 */
export function useSelectionAnchor({ isPanelOpen, onBeforeSelectionChange }: UseSelectionAnchorOptions) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const outsidePointerDownRef = useRef<PointerPoint | null>(null);
  const [selectionText, setSelectionText] = useState('');
  const [anchor, setAnchor] = useState<BubbleAnchor | null>(null);
  const hasSelection = Boolean(anchor && selectionText);

  /**
   * Clears selection UI state after notifying the request layer.
   */
  const hideBubble = useCallback(() => {
    onBeforeSelectionChange();
    setSelectionText('');
    setAnchor(null);
  }, [onBeforeSelectionChange]);

  /**
   * Refreshes bubble state from the browser selection object.
   */
  const refreshFromSelection = useCallback(() => {
    const snapshot = readSelectionSnapshot();
    if (!snapshot) {
      hideBubble();
      return;
    }

    if (snapshot.text !== selectionText) {
      onBeforeSelectionChange();
      setSelectionText(snapshot.text);
    }

    setAnchor(computeSelectionAnchor(snapshot.rect));
  }, [hideBubble, onBeforeSelectionChange, selectionText]);

  useEffect(() => {
    const onMouseUp = (event: MouseEvent) => {
      if (isEventInsideBubble(event, rootRef.current)) return;
      const outsidePointerDown = outsidePointerDownRef.current;
      outsidePointerDownRef.current = null;
      if (
        outsidePointerDown &&
        getPointerDistance(outsidePointerDown, { x: event.clientX, y: event.clientY }) <= clickMovementThreshold
      ) {
        return;
      }
      refreshFromSelection();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        hideBubble();
        return;
      }
      if (isPanelOpen) return;
      if (isEventInsideBubble(event, rootRef.current)) return;
      refreshFromSelection();
    };

    document.addEventListener('mouseup', onMouseUp);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('mouseup', onMouseUp);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [hideBubble, isPanelOpen, refreshFromSelection]);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (isEventInsideBubble(event, rootRef.current)) return;
      outsidePointerDownRef.current = hasSelection ? { x: event.clientX, y: event.clientY } : null;
      hideBubble();
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [hasSelection, hideBubble]);

  return {
    rootRef,
    selectionText,
    anchor,
    hasSelection,
  };
}
