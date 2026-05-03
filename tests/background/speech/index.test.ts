import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { initSpeechModule } from '../../../src/background/speech';
import { speechStopRequestType } from '../../../src/shared/types/speech';

describe('initSpeechModule', () => {
  it('only registers runtime listeners for speech start, stop, and state query', () => {
    initSpeechModule();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(3);
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
  });

  it('returns a stable null payload for stop responses', async () => {
    initSpeechModule();

    const listeners = globalThis.__chromeTestUtils.getRuntimeOnMessageAddListenerMock().mock.calls;
    // Find the stop listener (should be the second one)
    const stopListener = listeners[1]?.[0];
    const sendResponse = vi.fn();

    const keepChannelOpen = stopListener(
      { type: speechStopRequestType },
      { tab: { id: 7 } } as chrome.runtime.MessageSender,
      sendResponse,
    );

    expect(keepChannelOpen).toBe(true);

    await waitFor(() => {
      expect(sendResponse).toHaveBeenCalledWith({
        ok: true,
        data: null,
      });
    });
  });
});
