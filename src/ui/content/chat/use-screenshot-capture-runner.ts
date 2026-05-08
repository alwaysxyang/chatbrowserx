import { useRef, useState, type MutableRefObject } from 'react';
import { waitForScreenshotFrame } from './screenshot/screenshot-frame';
import type { ScreenshotRect } from './screenshot/screenshot-types';

interface UseScreenshotCaptureRunnerOptions {
  onCaptureVisibleTab: () => Promise<string>;
  selectionRef: MutableRefObject<ScreenshotRect>;
}

/**
 * Checks whether an element visually intersects the current screenshot selection.
 *
 * @param element - The candidate scrolling element.
 * @param selection - The active screenshot selection.
 * @returns True when the element overlaps the selection rectangle.
 */
export function doesSelectionIntersectElement(element: Element, selection: ScreenshotRect): boolean {
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
 * Coordinates screenshot capture while temporarily hiding overlay UI.
 *
 * @param options - Capture callback and current selection reference.
 * @returns Capture state, refs, and capture wrappers used by the overlay.
 */
export function useScreenshotCaptureRunner({ onCaptureVisibleTab, selectionRef }: UseScreenshotCaptureRunnerOptions) {
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

  /**
   * Runs a capture while the floating controls are hidden.
   *
   * @param capture - The capture callback to run while controls are hidden.
   * @returns The capture result.
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
   * Captures the visible tab for long mode without including overlapping controls.
   *
   * @returns The captured tab image as a data URL.
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

  return {
    controlsRef,
    isCapturing,
    isCapturingRef,
    runWithHiddenOverlay,
    captureVisibleTabForLongMode,
  };
}
