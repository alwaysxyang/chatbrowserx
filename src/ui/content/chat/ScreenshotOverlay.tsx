import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  captureSelectedViewport,
  createDefaultScreenshotSelection,
} from './screenshot/screenshot-capture';
import { resolveScreenshotScrollTargetAtPoint } from './screenshot/screenshot-scroll-target';
import type { ScreenshotRect } from './screenshot/screenshot-types';
import { useLongScreenshotSession } from './screenshot/use-long-screenshot-session';
import {
  buildScreenshotControlsStyle,
  getScreenshotSelectionCenter,
  ScreenshotControls,
} from './screenshot-controls';
import { useScreenshotCaptureRunner } from './use-screenshot-capture-runner';
import { useScreenshotInteraction } from './use-screenshot-interaction';
import { useScreenshotScrollForwarding } from './use-screenshot-scroll-forwarding';

interface ScreenshotOverlayProps {
  onCaptureVisibleTab: () => Promise<string>;
  onComplete: (dataUrl: string) => void;
  onCancel: () => void;
}

/**
 * Full-page screenshot overlay for viewport, selection, and manual long screenshots.
 *
 * @param props - Capture, completion, and cancellation handlers.
 * @returns The screenshot overlay shell.
 */
export function ScreenshotOverlay({ onCaptureVisibleTab, onComplete, onCancel }: ScreenshotOverlayProps) {
  const [selection, setSelection] = useState<ScreenshotRect>(() => createDefaultScreenshotSelection());
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  const {
    controlsRef,
    isCapturing,
    isCapturingRef,
    runWithHiddenOverlay,
    captureVisibleTabForLongMode,
  } = useScreenshotCaptureRunner({ onCaptureVisibleTab, selectionRef });
  const {
    isLongMode,
    isLongModeRef,
    completeLongCapture,
    queueWheelCapture,
    resetLongMode,
    startLongMode,
    stopLongModeQueue,
  } = useLongScreenshotSession({ onCaptureVisibleTab: captureVisibleTabForLongMode });
  const {
    cursor,
    interactionState,
    interactionStateRef,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useScreenshotInteraction({
    selection,
    setSelection,
    onInteractionStart: resetLongMode,
  });
  const controlsStyle = useMemo(() => buildScreenshotControlsStyle(selection, window.innerHeight), [selection]);

  /**
   * Returns the shadow host used to mount the content app, so hit testing can skip it.
   *
   * @returns The host elements that should be ignored during screenshot hit testing.
   */
  const getIgnoredHitTestElements = useCallback(() => {
    const rootNode = overlayRef.current?.getRootNode();

    if (rootNode instanceof ShadowRoot) {
      return [rootNode.host];
    }

    return [];
  }, []);

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

  useScreenshotScrollForwarding({
    overlayRef,
    interactionStateRef,
    isCapturingRef,
    isLongModeRef,
    queueWheelCapture,
    selection,
  });

  /**
   * Runs a screenshot capture and forwards successful data URLs to the owner.
   *
   * @param capture - The capture callback to execute with overlay hiding.
   */
  const runCapture = async (capture: () => Promise<string>) => {
    const dataUrl = await runWithHiddenOverlay(capture);

    if (typeof dataUrl === 'string') {
      onComplete(dataUrl);
    }
  };

  /**
   * Toggles manual long screenshot mode for the current selection.
   */
  const toggleLongMode = () => {
    if (isLongMode) {
      resetLongMode();
      return;
    }

    const center = getScreenshotSelectionCenter(selection);

    startLongMode(
      selection,
      resolveScreenshotScrollTargetAtPoint(center.x, center.y, getIgnoredHitTestElements()),
    );
  };

  /**
   * Completes long mode when active, otherwise captures the current selection.
   */
  const completeScreenshotAndFinish = async () => {
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
      <ScreenshotControls
        controlsRef={controlsRef}
        controlsStyle={controlsStyle}
        isCapturing={isCapturing}
        isLongMode={isLongMode}
        onFullscreenCapture={() => {
          void runCapture(onCaptureVisibleTab);
        }}
        onLongModeToggle={toggleLongMode}
        onDone={() => {
          if (isLongMode) {
            void completeScreenshotAndFinish();
            return;
          }

          void runCapture(() => captureSelectedViewport(onCaptureVisibleTab, selection));
        }}
      />
    </div>
  );
}
