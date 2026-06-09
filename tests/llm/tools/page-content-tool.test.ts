import { describe, expect, it } from 'vitest';
import { createGetPageContentTool } from '../../../src/llm/tools/page-content';

describe('get current page content LLM tool', () => {
  it('defines a request-bound current page content reader', async () => {
    const tool = createGetPageContentTool();
    const definition = await tool.definition();

    expect(definition).toEqual({
      type: 'function',
      function: {
        name: 'get_current_page_content',
        description: expect.stringContaining('Read the current page title, URL, and visible text content'),
        parameters: {
          type: 'object',
          properties: {},
          additionalProperties: false,
        },
      },
    });
    expect(definition?.function.description).toContain('Do not call this tool when the user request involves page operations');
  });

  it('sends the content request to the invocation tab without querying the active tab', async () => {
    const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();
    tabsQueryMock.mockResolvedValue([{ id: 9 }]);
    tabsSendMessageMock.mockResolvedValue({
      title: 'Doc',
      url: 'https://example.com/doc',
      content: 'Alpha\nBeta',
    });

    const tool = createGetPageContentTool();

    await expect(tool.invoke({ pageToolTabId: 43 }, {})).resolves.toEqual({
      title: 'Doc',
      url: 'https://example.com/doc',
      content: 'Alpha\nBeta',
    });
    expect(tabsQueryMock).not.toHaveBeenCalled();
    expect(tabsSendMessageMock).toHaveBeenCalledWith(43, {
      type: 'chatbrowserx.tool.get-page-content.request',
    });
  });
});
