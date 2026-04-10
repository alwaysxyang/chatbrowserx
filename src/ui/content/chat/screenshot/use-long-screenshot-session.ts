import { useRef, useState } from 'react';
import {
  captureLongScreenshotSegments,
  getScreenshotDocumentRange,
  getUncapturedLongScreenshotSegments,
  stitchLongScreenshotChunks,
} from './screenshot-capture';
import { waitForScreenshotFrame } from './screenshot-frame';
import type { CapturedLongScreenshotChunk, ScreenshotRect } from './screenshot-types';

interface UseLongScreenshotSessionOptions {
  onCaptureVisibleTab: () => Promise<string>;
}

export function useLongScreenshotSession({ onCaptureVisibleTab }: UseLongScreenshotSessionOptions) {
  const [isLongMode, setIsLongMode] = useState(false);
  const isLongModeRef = useRef(false);
  const longChunksRef = useRef<CapturedLongScreenshotChunk[]>([]);
  const longCapturePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const longModeRunIdRef = useRef(0);

  const queueLongCaptureTask = (task: () => Promise<void>) => {
    const nextCapture = longCapturePromiseRef.current.then(task, task);
    longCapturePromiseRef.current = nextCapture.then(
      () => undefined,
      () => undefined,
    );
    void longCapturePromiseRef.current;
  };

  const captureMissingLongSelectionChunks = async (selection: ScreenshotRect, runId: number) => {
    if (longModeRunIdRef.current !== runId) {
      return;
    }

    const segments = getUncapturedLongScreenshotSegments(
      getScreenshotDocumentRange(selection),
      longChunksRef.current,
    );

    if (!segments.length) {
      return;
    }

    const chunks = await captureLongScreenshotSegments(onCaptureVisibleTab, selection, segments);

    if (!chunks?.length || longModeRunIdRef.current !== runId) {
      return;
    }

    longChunksRef.current = [...longChunksRef.current, ...chunks].sort((left, right) => left.startY - right.startY);
  };

  const captureLongSelectionChunks = (selection: ScreenshotRect, runId: number) => {
    queueLongCaptureTask(() => captureMissingLongSelectionChunks(selection, runId));
  };

  const resetLongMode = () => {
    longModeRunIdRef.current += 1;
    isLongModeRef.current = false;
    setIsLongMode(false);
    longChunksRef.current = [];
    longCapturePromiseRef.current = Promise.resolve();
  };

  const startLongMode = (selection: ScreenshotRect) => {
    longModeRunIdRef.current += 1;
    const runId = longModeRunIdRef.current;
    isLongModeRef.current = true;
    longChunksRef.current = [];
    longCapturePromiseRef.current = Promise.resolve();
    setIsLongMode(true);
    captureLongSelectionChunks(selection, runId);
  };

  const stopLongModeQueue = () => {
    longModeRunIdRef.current += 1;
    isLongModeRef.current = false;
    setIsLongMode(false);
  };

  const queueWheelCapture = (selection: ScreenshotRect, deltaX: number, deltaY: number) => {
    const runId = longModeRunIdRef.current;

    queueLongCaptureTask(async () => {
      if (longModeRunIdRef.current !== runId) {
        return;
      }

      if (typeof window.scrollBy === 'function') {
        window.scrollBy({ left: deltaX, top: deltaY, behavior: 'auto' });
      } else {
        window.scrollTo(window.scrollX + deltaX, window.scrollY + deltaY);
      }

      await waitForScreenshotFrame();
      await captureMissingLongSelectionChunks(selection, runId);
    });
  };

  const completeLongCapture = async (): Promise<string | undefined> => {
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
