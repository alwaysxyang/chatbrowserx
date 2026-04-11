import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useLongScreenshotSession } from '../../../../src/ui/content/chat/screenshot/use-long-screenshot-session';
import type { ScreenshotRect } from '../../../../src/ui/content/chat/screenshot/screenshot-types';

const {
  captureLongScreenshotSegmentsMock,
  getScreenshotDocumentRangeMock,
  getUncapturedLongScreenshotSegmentsMock,
  stitchLongScreenshotChunksMock,
  waitForScreenshotFrameMock,
  waitForScreenshotStableMock,
} = vi.hoisted(() => ({
  captureLongScreenshotSegmentsMock: vi.fn(),
  getScreenshotDocumentRangeMock: vi.fn(),
  getUncapturedLongScreenshotSegmentsMock: vi.fn(),
  stitchLongScreenshotChunksMock: vi.fn(),
  waitForScreenshotFrameMock: vi.fn(),
  waitForScreenshotStableMock: vi.fn(),
}));

vi.mock('../../../../src/ui/content/chat/screenshot/screenshot-capture', () => ({
  captureLongScreenshotSegments: captureLongScreenshotSegmentsMock,
  getScreenshotDocumentRange: getScreenshotDocumentRangeMock,
  getUncapturedLongScreenshotSegments: getUncapturedLongScreenshotSegmentsMock,
  stitchLongScreenshotChunks: stitchLongScreenshotChunksMock,
}));

vi.mock('../../../../src/ui/content/chat/screenshot/screenshot-frame', () => ({
  waitForScreenshotFrame: waitForScreenshotFrameMock,
  waitForScreenshotStable: waitForScreenshotStableMock,
}));

const selection: ScreenshotRect = {
  left: 20,
  top: 40,
  width: 240,
  height: 180,
};

describe('useLongScreenshotSession', () => {
  beforeEach(() => {
    captureLongScreenshotSegmentsMock.mockReset().mockResolvedValue([]);
    getScreenshotDocumentRangeMock.mockReset().mockReturnValue({ startY: 40, endY: 220 });
    getUncapturedLongScreenshotSegmentsMock.mockReset().mockReturnValue([{ startY: 40, endY: 220 }]);
    stitchLongScreenshotChunksMock.mockReset();
    waitForScreenshotFrameMock.mockReset().mockResolvedValue(undefined);
    waitForScreenshotStableMock.mockReset().mockResolvedValue(undefined);
  });

  it('waits for screenshot stability when flushing the last pending long screenshot capture', async () => {
    const { result } = renderHook(() =>
      useLongScreenshotSession({
        onCaptureVisibleTab: vi.fn(async () => 'data:image/png;base64,viewport'),
      }),
    );

    act(() => {
      result.current.startLongMode(selection);
    });

    await waitFor(() => {
      expect(captureLongScreenshotSegmentsMock).toHaveBeenCalledTimes(1);
    });

    act(() => {
      result.current.queueWheelCapture(selection);
    });

    await act(async () => {
      await result.current.completeLongCapture(selection);
    });

    await waitFor(() => {
      expect(waitForScreenshotStableMock).toHaveBeenCalledTimes(1);
    });
    expect(waitForScreenshotFrameMock).not.toHaveBeenCalled();
  });
});
