import { waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const panelStateKey = 'chatbrowserx.panel';

describe('content entry', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    globalThis.__chromeTestUtils
      .getRuntimeConnectMock()
      .mockImplementation((options?: chrome.runtime.ConnectInfo) => globalThis.__chromeTestUtils.createRuntimePort(options));
  });

  afterEach(async () => {
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
    });
    document.body.innerHTML = '';
  });

  it('opens the shared page lifecycle runtime port used by page-scoped features', async () => {
    const connectMock = globalThis.__chromeTestUtils.getRuntimeConnectMock();

    await act(async () => {
      await import('../../../src/ui/content/index');
    });

    expect(connectMock).toHaveBeenCalledWith({
      name: 'chatbrowserx.chat.session',
    });
  });

  it('restores a pinned open panel when the host page removes the extension root', async () => {
    await chrome.storage.local.set({
      [panelStateKey]: {
        pinned: true,
        open: true,
      },
    });

    await act(async () => {
      await import('../../../src/ui/content/index');
    });

    const firstHost = document.getElementById('chatbrowserx-root');
    expect(firstHost).toBeInTheDocument();

    await waitFor(() => {
      expect(firstHost?.shadowRoot?.textContent).toContain('ChatBrowserX');
    });

    await act(async () => {
      firstHost?.remove();
      await Promise.resolve();
    });

    await waitFor(() => {
      const nextHost = document.getElementById('chatbrowserx-root');
      expect(nextHost).toBeInTheDocument();
      expect(nextHost).not.toBe(firstHost);
      expect(nextHost?.shadowRoot?.textContent).toContain('ChatBrowserX');
    });
  });
});
