import { describe, expect, it, vi } from 'vitest';
import { createGetPageInteractablesTool } from '../../../src/llm/tools/get-page-interactables-tool';

describe('get page interactables tool', () => {
  it('is a compact read-only snapshot tool', async () => {
    const tool = createGetPageInteractablesTool();
    const definition = await tool.definition();

    expect(definition?.function.name).toBe('get_current_page_interactables');
    expect(definition?.function.parameters).toEqual({ type: 'object', properties: {}, additionalProperties: false });
    expect(definition?.function.description ?? '').toContain('compact read-only snapshot');
    expect(definition?.function.description ?? '').toContain('items:[[ref,role,name,[x,y,width,height],meta?]]');
  });

  it('queries the active tab and requests a content-script snapshot inside invoke', async () => {
    const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();

    tabsQueryMock.mockResolvedValue([{ id: 9 }]);
    tabsSendMessageMock.mockResolvedValue({
      v: [1000, 800],
      sid: 's_test',
      items: [['e1', 'button', 'OK', [10, 20, 100, 40]]],
    });

    const tool = createGetPageInteractablesTool();

    await expect(tool.invoke({})).resolves.toEqual({
      v: [1000, 800],
      sid: 's_test',
      items: [['e1', 'button', 'OK', [10, 20, 100, 40]]],
    });
    expect(tabsQueryMock).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(9, {
      type: 'chatbrowserx.tool.get-page-interactables.request',
    });
  });
});
