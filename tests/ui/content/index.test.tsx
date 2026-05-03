import { describe, expect, it } from 'vitest';

describe('content entry', () => {
  it('opens a runtime port to keep chat session bound to the page lifecycle', async () => {
    const connectMock = globalThis.__chromeTestUtils.getRuntimeConnectMock();

    await import('../../../src/ui/content/index');

    expect(connectMock).toHaveBeenCalledWith({
      name: 'chatbrowserx.chat.session',
    });
  });
});
