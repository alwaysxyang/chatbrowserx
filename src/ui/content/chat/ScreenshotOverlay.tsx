import { useEffect, useMemo, useState } from 'react';
import {
  captureSelectedViewport,
  createDefaultScreenshotSelection,
} from './screenshot/screenshot-capture';
import type { ScreenshotRect } from './screenshot/screenshot-types';
import {
  buildScreenshotControlsStyle,
  ScreenshotControls,
} from './screenshot-controls';
import { useScreenshotCaptureRunner } from './use-screenshot-capture-runner';
import { useScreenshotInteraction } from './use-screenshot-interaction';

interface ScreenshotOverlayProps {
  onCaptureVisibleTab: () => Promise<string>;
  onComplete: (dataUrl: string) => void;
  onCancel: () => void;
}

/**
 * Full-page screenshot overlay for viewport and selection captures.
 *
 * @param props - Capture, completion, and cancellation handlers.
 * @returns The screenshot overlay shell.
 */
export function ScreenshotOverlay({ onCaptureVisibleTab, onComplete, onCancel }: ScreenshotOverlayProps) {
  const [selection, setSelection] = useState<ScreenshotRect>(() => createDefaultScreenshotSelection());

  const {
    controlsRef,
    isCapturing,
    runWithHiddenOverlay,
  } = useScreenshotCaptureRunner();
  const {
    cursor,
    interactionState,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
  } = useScreenshotInteraction({
    selection,
    setSelection,
    onInteractionStart: () => undefined,
  });
  const controlsStyle = useMemo(() => buildScreenshotControlsStyle(selection, window.innerHeight), [selection]);

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

  return (
    <div
      className={`screenshot-overlay ${isCapturing ? 'screenshot-overlay-capturing' : ''} ${interactionState ? 'screenshot-overlay-interacting' : ''}`}
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
        onFullscreenCapture={() => {
          void runCapture(onCaptureVisibleTab);
        }}
        onDone={() => {
          void runCapture(() => captureSelectedViewport(onCaptureVisibleTab, selection));
        }}
      />
    </div>
  );
}
