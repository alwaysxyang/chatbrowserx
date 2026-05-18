import { describe, expect, it, vi } from 'vitest';
import { createToolMessageSender, type ToolMessageSender } from '../../../src/llm/tools/shared/tab-message-tool';
import type { InvokeContext } from '../../../src/llm/tools/tool-registry';

describe('tab message tool helpers', () => {
  it('passes tool invocation context as the first sender argument', async () => {
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();
    const resolveTabId = vi.fn(async (context?: InvokeContext) => context?.pageToolTabId ?? 9);
    const sender = createToolMessageSender(resolveTabId) as ToolMessageSender;

    tabsSendMessageMock.mockResolvedValue({ ok: true });

    await expect(sender({ pageToolTabId: 43 }, { type: 'tool.request' })).resolves.toEqual({ ok: true });

    expect(resolveTabId).toHaveBeenCalledWith({ pageToolTabId: 43 });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(43, { type: 'tool.request' });
  });
});
