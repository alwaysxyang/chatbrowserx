import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('background action click', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('sends a panel command to the active tab', async () => {
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();
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
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();

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

  it('cancels in-flight chat when the content runtime port disconnects', async () => {
    const cancelMock = vi.fn();
    const completeMock = vi.fn();

    vi.doMock('../../src/background/llm/llm-orchestrator', () => ({
      LlmOrchestrator: vi.fn().mockImplementation(() => ({
        complete: completeMock,
        cancel: cancelMock,
      })),
    }));

    await import('../../src/background/index');

    const port = globalThis.__chromeTestUtils.createRuntimePort({
      name: 'chatbrowserx.chat.session',
      tabId: 37,
    });

    port.__disconnect();

    expect(cancelMock).toHaveBeenCalledWith(37);
  });
});
