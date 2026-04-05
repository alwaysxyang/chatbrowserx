import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('background action click', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sends a panel command to the active tab', async () => {
    const tabsSendMessageMock = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;
    tabsSendMessageMock.mockResolvedValueOnce(undefined);

    await import('../../src/background/index');

    globalThis.__chromeTestUtils.dispatchActionClick({ id: 11 } as chrome.tabs.Tab);

    await waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(11, {
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });
  });

  it('does not reload or inject when panel message sending fails', async () => {
    const tabsSendMessageMock = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;

    tabsSendMessageMock.mockRejectedValueOnce(new Error('Could not establish connection. Receiving end does not exist.'));

    await import('../../src/background/index');

    globalThis.__chromeTestUtils.dispatchActionClick({ id: 21 } as chrome.tabs.Tab);

    await waitFor(() => {
      expect(chrome.tabs.sendMessage).toHaveBeenCalledWith(21, {
        type: 'chatbrowserx.panel.command',
        payload: { command: 'toggle-chat' },
      });
    });

    expect(chrome.scripting.executeScript).not.toHaveBeenCalled();
    expect(chrome.tabs.reload).not.toHaveBeenCalled();
  });
});
