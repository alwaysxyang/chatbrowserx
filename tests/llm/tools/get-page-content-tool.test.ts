import { describe, expect, it, vi } from 'vitest';
import { createGetPageContentTool } from '../../../src/llm/tools/get-page-content-tool';

describe('get page content tool', () => {
  it('describes itself as a read-only analysis tool instead of a page action tool', async () => {
    const tool = createGetPageContentTool();
    const definition = await tool.definition();
    const description = definition?.function.description ?? '';

    expect(description).toContain('Use this tool only for read-only analysis of the current page');
    expect(description).toContain('Do not use this tool for page actions or action planning.');
    expect(description).toContain(
      'clicking, typing, selecting, dragging, opening menus, submitting forms, navigating',
    );
  });

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

    await expect(tool.invoke({})).resolves.toEqual({
      title: 'Example title',
      url: 'https://example.com/article',
      content: 'Example body text',
    });
    expect(tabsQueryMock).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(9, {
      type: 'chatbrowserx.tool.get-page-content.request',
    });
  });
});
