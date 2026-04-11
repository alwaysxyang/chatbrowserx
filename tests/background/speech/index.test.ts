import { waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { initSpeechModule } from '../../../src/background/speech';
import { speechStopRequestType } from '../../../src/shared/types/runtime-messages';

describe('initSpeechModule', () => {
  it('only registers runtime listeners for speech start and stop', () => {
    initSpeechModule();

    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(2);
    expect(chrome.tabs.onRemoved.addListener).toHaveBeenCalledTimes(1);
  });

  it('returns a stable null payload for stop responses', async () => {
    initSpeechModule();

    const listener = (chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>).mock.calls.at(-1)?.[0];
    const sendResponse = vi.fn();

    const keepChannelOpen = listener(
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
