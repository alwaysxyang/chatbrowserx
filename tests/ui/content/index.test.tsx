import { describe, expect, it } from 'vitest';

describe('content entry', () => {
  it('opens the shared page lifecycle runtime port used by page-scoped features', async () => {
    const connectMock = globalThis.__chromeTestUtils.getRuntimeConnectMock();

    await import('../../../src/ui/content/index');

    expect(connectMock).toHaveBeenCalledWith({
      name: 'chatbrowserx.chat.session',
    });
  });
});
