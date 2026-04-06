import { describe, expect, it, vi } from 'vitest';
import { createGetPageContentTool } from '../../../src/llm/tools/get-page-content-tool';

describe('get page content tool', () => {
  it('queries the active tab and requests page content inside invoke', async () => {
    const tabsQueryMock = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    const tabsSendMessageMock = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;

    tabsQueryMock.mockResolvedValue([{ id: 9 }]);
    tabsSendMessageMock.mockResolvedValue({
      title: 'Example title',
      url: 'https://example.com/article',
      content: 'Example body text',
    });

    const tool = createGetPageContentTool();

    await expect(tool.invoke({})).resolves.toBe(
      JSON.stringify({
        title: 'Example title',
        url: 'https://example.com/article',
        content: 'Example body text',
      }),
    );
    expect(tabsQueryMock).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(9, {
      type: 'chatbrowserx.tool.get-page-content.request',
    });
  });
});
