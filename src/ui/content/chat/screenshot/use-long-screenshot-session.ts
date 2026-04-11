import { useRef, useState } from 'react';
import {
  captureLongScreenshotSegments,
  getUncapturedLongScreenshotSegments,
  stitchLongScreenshotChunks,
} from './screenshot-capture';
import { waitForScreenshotFrame, waitForScreenshotStable } from './screenshot-frame';
import {
  createLongScreenshotCaptureArea,
  type ScreenshotScrollTarget,
} from './screenshot-scroll-target';
import type { CapturedLongScreenshotChunk, ScreenshotRect } from './screenshot-types';

interface UseLongScreenshotSessionOptions {
  onCaptureVisibleTab: () => Promise<string>;
}

/**
 * Manage the state and capture queue for a manual long screenshot session.
 *
 * @param options - The screenshot capture bridge used by the content overlay
 * @returns The long screenshot session state and control methods
 */
export function useLongScreenshotSession({ onCaptureVisibleTab }: UseLongScreenshotSessionOptions) {
  const [isLongMode, setIsLongMode] = useState(false);
  const isLongModeRef = useRef(false);
  const longChunksRef = useRef<CapturedLongScreenshotChunk[]>([]);
  const longCapturePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const longModeRunIdRef = useRef(0);
  const captureTimeoutRef = useRef<number | null>(null);
  const pendingCaptureSelectionRef = useRef<ScreenshotRect | null>(null);
  const pendingCaptureRunIdRef = useRef<number | null>(null);
  const scrollTargetRef = useRef<ScreenshotScrollTarget>(window);

  /**
   * Append a long-screenshot capture task to the serialized queue.
   *
   * @param task - The async capture task to run after previous work completes
   */
  const queueLongCaptureTask = (task: () => Promise<void>) => {
    const nextCapture = longCapturePromiseRef.current.then(task, task);
    longCapturePromiseRef.current = nextCapture.then(
      () => undefined,
      () => undefined,
    );
    void longCapturePromiseRef.current;
  };

  /**
   * Clear both the debounced timer and buffered capture request.
   */
  const clearPendingCapture = () => {
    if (captureTimeoutRef.current !== null) {
      clearTimeout(captureTimeoutRef.current);
      captureTimeoutRef.current = null;
    }
    pendingCaptureSelectionRef.current = null;
    pendingCaptureRunIdRef.current = null;
  };

  /**
   * Check if a run ID is still the active run.
   *
   * @param runId - The run ID to check
   * @returns True if the run is still active
   */
  const isActiveRun = (runId: number) => longModeRunIdRef.current === runId;

  /**
   * Capture any still-missing long-screenshot chunks for the current scroll position.
   *
   * @param selection - The current screenshot selection
   * @param runId - The active long-mode run identifier
   */
  const captureMissingLongSelectionChunks = async (selection: ScreenshotRect, runId: number) => {
    if (!isActiveRun(runId)) {
      return;
    }

    const captureArea = createLongScreenshotCaptureArea(selection, scrollTargetRef.current);
    const segments = getUncapturedLongScreenshotSegments(
      captureArea.range,
      longChunksRef.current,
    );

    if (!segments.length) {
      return;
    }

    const chunks = await captureLongScreenshotSegments(onCaptureVisibleTab, captureArea, segments);

    if (!chunks?.length || !isActiveRun(runId)) {
      return;
    }

    longChunksRef.current = [...longChunksRef.current, ...chunks].sort((left, right) => left.startY - right.startY);
  };

  /**
   * Queue an immediate capture attempt for the current selection.
   *
   * @param selection - The current screenshot selection
   * @param runId - The active long-mode run identifier
   */
  const captureLongSelectionChunks = (selection: ScreenshotRect, runId: number) => {
    queueLongCaptureTask(() => captureMissingLongSelectionChunks(selection, runId));
  };

  /**
   * Queue a post-scroll capture with the provided readiness wait strategy.
   *
   * @param selection - The current long screenshot selection
   * @param runId - The active long-mode run identifier
   * @param waitForCaptureReady - The async wait applied before capturing
   */
  const queuePostScrollCapture = (
    selection: ScreenshotRect,
    runId: number,
    waitForCaptureReady: () => Promise<void>,
  ) => {
    queueLongCaptureTask(async () => {
      if (!isActiveRun(runId)) {
        return;
      }

      await waitForCaptureReady();
      await captureMissingLongSelectionChunks(selection, runId);
    });
  };

  /**
   * Reset the long screenshot session state and discard any queued work.
   */
  const resetLongMode = () => {
    clearPendingCapture();
    longModeRunIdRef.current += 1;
    isLongModeRef.current = false;
    setIsLongMode(false);
    longChunksRef.current = [];
    longCapturePromiseRef.current = Promise.resolve();
    scrollTargetRef.current = window;
  };

  /**
   * Start a new long screenshot session for the resolved scroll target.
   *
   * @param selection - The current screenshot selection
   * @param scrollTarget - The scroll target that owns the moving content
   */
  const startLongMode = (selection: ScreenshotRect, scrollTarget: ScreenshotScrollTarget = window) => {
    longModeRunIdRef.current += 1;
    const runId = longModeRunIdRef.current;
    isLongModeRef.current = true;
    longChunksRef.current = [];
    longCapturePromiseRef.current = Promise.resolve();
    scrollTargetRef.current = scrollTarget;
    setIsLongMode(true);
    captureLongSelectionChunks(selection, runId);
  };

  /**
   * Stop long mode without producing a stitched result.
   */
  const stopLongModeQueue = () => {
    clearPendingCapture();
    longModeRunIdRef.current += 1;
    isLongModeRef.current = false;
    setIsLongMode(false);
  };

  /**
   * Queue a buffered long-screenshot capture after manual scrolling without blocking
   * the next wheel step. Repeated scroll events reuse the same timer window so the
   * capture cadence stays bounded during fast scrolling.
   *
   * @param selection - The current screenshot selection
   */
  const queueWheelCapture = (selection: ScreenshotRect) => {
    const runId = longModeRunIdRef.current;

    pendingCaptureSelectionRef.current = selection;
    pendingCaptureRunIdRef.current = runId;

    if (captureTimeoutRef.current !== null) {
      return;
    }

    captureTimeoutRef.current = window.setTimeout(() => {
      captureTimeoutRef.current = null;
      const pendingSelection = pendingCaptureSelectionRef.current;
      const pendingRunId = pendingCaptureRunIdRef.current;

      pendingCaptureSelectionRef.current = null;
      pendingCaptureRunIdRef.current = null;

      if (!pendingSelection || pendingRunId === null || !isActiveRun(pendingRunId)) {
        return;
      }

      queuePostScrollCapture(pendingSelection, pendingRunId, waitForScreenshotFrame);
    }, 80);
  };

  /**
   * Flush the last debounced capture before long mode completes.
   *
   * @param selection - The current long screenshot selection
   */
  const flushPendingLongCapture = (selection: ScreenshotRect) => {
    const pendingSelection = pendingCaptureSelectionRef.current ?? selection;
    const pendingRunId = pendingCaptureRunIdRef.current ?? longModeRunIdRef.current;

    if (captureTimeoutRef.current === null && pendingCaptureSelectionRef.current === null) {
      return;
    }

    clearPendingCapture();

    if (!isActiveRun(pendingRunId)) {
      return;
    }

    queuePostScrollCapture(pendingSelection, pendingRunId, waitForScreenshotStable);
  };

  /**
   * Finalize the long screenshot by flushing pending captures and stitching chunks.
   *
   * @param selection - The current screenshot selection
   * @returns The stitched long screenshot data URL, when at least one chunk exists
   */
  const completeLongCapture = async (selection: ScreenshotRect): Promise<string | undefined> => {
    flushPendingLongCapture(selection);
    await longCapturePromiseRef.current;

    if (!longChunksRef.current.length) {
      return undefined;
    }

    return stitchLongScreenshotChunks(longChunksRef.current);
  };

  return {
    isLongMode,
    isLongModeRef,
    completeLongCapture,
    queueWheelCapture,
    resetLongMode,
    startLongMode,
    stopLongModeQueue,
  };
}
