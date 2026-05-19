import { useRef, useState } from 'react';
import { waitForScreenshotFrame } from './screenshot/screenshot-frame';

/**
 * Coordinates screenshot capture while temporarily hiding overlay UI.
 *
 * @returns Capture state, refs, and capture wrappers used by the overlay.
 */
export function useScreenshotCaptureRunner() {
  const controlsRef = useRef<HTMLDivElement | null>(null);
  const isCapturingRef = useRef(false);
  const [isCapturing, setIsCapturing] = useState(false);

  /**
   * Runs a capture while the full overlay is hidden from the captured frame.
   *
   * @param capture - The capture callback to run once the overlay is hidden.
   * @returns The capture result, or undefined when another capture is active.
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

  return {
    controlsRef,
    isCapturing,
    runWithHiddenOverlay,
  };
}
