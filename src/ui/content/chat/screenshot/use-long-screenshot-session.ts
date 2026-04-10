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
  const captureTimeoutRef = useRef<number | null>(null);

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

  const queueWheelCapture = (
    selection: ScreenshotRect,
    deltaX: number,
    deltaY: number,
    scrollTarget: Window | HTMLElement,
  ) => {
    const runId = longModeRunIdRef.current;

    // 浏览器已经处理了滚动，我们不需要手动滚动
    // 只需要在滚动后触发截图

    // 防抖截图：清除之前的定时器，只在滚动停止后截图
    if (captureTimeoutRef.current !== null) {
      clearTimeout(captureTimeoutRef.current);
    }

    captureTimeoutRef.current = window.setTimeout(() => {
      captureTimeoutRef.current = null;

      queueLongCaptureTask(async () => {
        if (longModeRunIdRef.current !== runId) {
          return;
        }

        // 使用快速等待，只等待2帧，不等待图片加载
        await waitForScreenshotFrame();
        await captureMissingLongSelectionChunks(selection, runId);
      });
    }, 100); // 100ms 防抖，滚动停止后才截图
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
