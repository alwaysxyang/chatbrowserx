import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { registerScreenshotCaptureHandler } from '../../../src/background/chat/screenshot-capture';
import { screenshotCaptureRequestType } from '../../../src/shared/types/chat';

describe('background screenshot capture', () => {
  it('captures the visible tab for screenshot requests', async () => {
    const captureVisibleTabMock = globalThis.__chromeTestUtils.getTabsCaptureVisibleTabMock();
    captureVisibleTabMock.mockResolvedValue('data:image/png;base64,abc123');

    registerScreenshotCaptureHandler();

    const listener = globalThis.__chromeTestUtils.getRuntimeOnMessageAddListenerMock().mock.calls.at(-1)?.[0];
    const sendResponse = vi.fn();

    const keepChannelOpen = listener(
      { type: screenshotCaptureRequestType },
      { tab: { windowId: 77 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(keepChannelOpen).toBe(true);

    await waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        data: { dataUrl: 'data:image/png;base64,abc123' },
      });
    });

    expect(captureVisibleTabMock).toHaveBeenCalledWith(77, { format: 'png' });
  });
});
