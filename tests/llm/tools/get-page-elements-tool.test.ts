import { describe, expect, it } from 'vitest';
import { createGetPageElementsTool } from '../../../src/llm/tools/get-page-elements-tool';

describe('get page elements tool', () => {
  it('is a compact current-viewport element snapshot tool', async () => {
    const tool = createGetPageElementsTool();
    const definition = await tool.definition();

    expect(definition?.function.name).toBe('get_current_page_elements');
    expect(definition?.function.parameters).toEqual({ type: 'object', properties: {}, additionalProperties: false });
    expect(definition?.function.description ?? '').toContain('CURRENT viewport');
    expect(definition?.function.description ?? '').toContain('heading');
    expect(definition?.function.description ?? '').toContain('text');
    expect(definition?.function.description ?? '').toContain('op=true');
    expect(definition?.function.description ?? '').toContain('w=true');
    expect(definition?.function.description ?? '').toContain('does not click, type, scroll, navigate, or auto-scroll');
    expect(definition?.function.description ?? '').toContain('items:[[ref,role,name,[x,y,width,height],meta?]]');
  });

  it('guides page analysis to behave like a human viewport reader', async () => {
    const tool = createGetPageElementsTool();
    const definition = await tool.definition();
    const description = definition?.function.description ?? '';

    expect(description).toContain('page analysis');
    expect(description).toContain('like a human');
    expect(description).toContain('page_scroll');
    expect(description).toContain('not enough to answer');
    expect(description).toContain('whole-page');
    expect(description).toContain('do not conclude from one partial viewport');
    expect(description).toContain('until scrolling no longer reveals new relevant content');
    expect(description).toContain('stable scan direction');
    expect(description).toContain('do not bounce between down and up');
    expect(description).toContain('Avoid unnecessary repeated snapshots for the same unchanged viewport');
    expect(description).toContain('Refresh after page actions such as page_scroll, page_click, page_type, or page_drag');
    expect(description).toContain('when enough time has passed');
    expect(description).toContain('when a fresh snapshot is necessary');
    expect(description).toContain('Do not click navigation, outline, menu, toolbar, or AI summary controls');
    expect(description).toContain('only visible navigation or outline entries');
    expect(description).toContain('scroll the relevant scrollarea instead of clicking those entries');
  });

  it('queries the active tab and requests a content-script snapshot inside invoke', async () => {
    const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
    const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();

    tabsQueryMock.mockResolvedValue([{ id: 9 }]);
    tabsSendMessageMock.mockResolvedValue({
      v: [1000, 800],
      sid: 's_test',
      items: [['e1', 'button', 'OK', [10, 20, 100, 40], { op: true }]],
    });

    const tool = createGetPageElementsTool();

    await expect(tool.invoke(undefined, {})).resolves.toEqual({
      v: [1000, 800],
      sid: 's_test',
      items: [['e1', 'button', 'OK', [10, 20, 100, 40], { op: true }]],
    });
    expect(tabsQueryMock).toHaveBeenCalledWith({ active: true, currentWindow: true });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(9, {
      type: 'chatbrowserx.tool.get-page-elements.request',
    });
  });
});
