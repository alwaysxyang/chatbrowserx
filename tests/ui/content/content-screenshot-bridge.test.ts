import { describe, expect, it } from 'vitest';
import { requestVisibleTabScreenshot } from '../../../src/ui/content/content-screenshot-bridge';

describe('content screenshot bridge', () => {
  it('returns screenshot data when the runtime request succeeds', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({
      ok: true,
      data: { dataUrl: 'data:image/png;base64,shot' },
    });

    await expect(requestVisibleTabScreenshot()).resolves.toBe('data:image/png;base64,shot');
  });

  it('throws the fallback request error when the runtime request resolves with failure', async () => {
    const sendMessageMock = chrome.runtime.sendMessage as unknown as ReturnType<typeof vi.fn>;
    sendMessageMock.mockResolvedValue({ ok: false, error: '' });

    await expect(requestVisibleTabScreenshot()).rejects.toThrow('请求失败');
  });
});
