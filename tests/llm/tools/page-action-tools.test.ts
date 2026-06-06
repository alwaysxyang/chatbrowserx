import { describe, expect, it, vi } from 'vitest';
import {
  createPageClickTool,
  createPageDragTool,
  createPageMouseMoveTool,
  createPageScrollTool,
  createPageTypeTool,
} from '../../../src/llm/tools/page-actions';

/**
 * Configures the Chrome tab mocks for a resolved active tab.
 *
 * @param tabId - The active tab ID returned by chrome.tabs.query.
 * @returns The tabs mocks used by page action tools.
 */
function mockActiveTab(tabId = 42): {
  tabsQueryMock: ReturnType<typeof vi.fn>;
  tabsSendMessageMock: ReturnType<typeof vi.fn>;
} {
  const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
  const tabsSendMessageMock = globalThis.__chromeTestUtils.getTabsSendMessageMock();

  tabsQueryMock.mockResolvedValue([{ id: tabId }]);

  return { tabsQueryMock, tabsSendMessageMock };
}

describe('page action tools', () => {
  it('defines ref-based page action tools without coordinate parameters', async () => {
    const definitions = await Promise.all([
      createPageMouseMoveTool().definition(),
      createPageClickTool().definition(),
      createPageTypeTool().definition(),
      createPageScrollTool().definition(),
      createPageDragTool().definition(),
    ]);

    expect(definitions.map((definition) => definition?.function.name)).toEqual([
      'page_mouse_move',
      'page_click',
      'page_type',
      'page_scroll',
      'page_drag',
    ]);
    expect(definitions[1]?.function.parameters).toMatchObject({
      properties: { sid: { type: 'string' }, ref: { type: 'string' } },
      required: ['sid', 'ref'],
    });
    expect(JSON.stringify(definitions)).not.toContain('"x"');
    expect(JSON.stringify(definitions)).not.toContain('"y"');
  });

  it('routes click actions to the active tab content script', async () => {
    const { tabsSendMessageMock } = mockActiveTab();
    tabsSendMessageMock.mockResolvedValue({ ok: true, action: 'click', ref: 'e13' });

    await expect(createPageClickTool().invoke(undefined, { sid: 's_latest', ref: 'e13' })).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e13',
    });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(42, {
      type: 'chatbrowserx.tool.page-action.request',
      action: 'click',
      sid: 's_latest',
      ref: 'e13',
    });
  });

  it('falls back to the last focused active tab when currentWindow has no active tab', async () => {
    const { tabsQueryMock, tabsSendMessageMock } = mockActiveTab();
    tabsQueryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 87 }]);
    tabsSendMessageMock.mockResolvedValue({ ok: true, action: 'click', ref: 'e22' });

    await expect(createPageClickTool().invoke(undefined, { sid: 's_1', ref: 'e22' })).resolves.toEqual({
      ok: true,
      action: 'click',
      ref: 'e22',
    });
    expect(tabsQueryMock).toHaveBeenNthCalledWith(1, { active: true, currentWindow: true });
    expect(tabsQueryMock).toHaveBeenNthCalledWith(2, { active: true, lastFocusedWindow: true });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(87, {
      type: 'chatbrowserx.tool.page-action.request',
      action: 'click',
      sid: 's_1',
      ref: 'e22',
    });
  });

  it('routes scroll actions with an optional target scrollarea ref', async () => {
    const { tabsSendMessageMock } = mockActiveTab();
    tabsSendMessageMock.mockResolvedValue({ ok: true, action: 'scroll', ref: 'e3' });

    await expect(createPageScrollTool().invoke(undefined, { direction: 'down', sid: 's_1', ref: 'e3', amount: 320 })).resolves.toEqual({
      ok: true,
      action: 'scroll',
      ref: 'e3',
    });
    expect(tabsSendMessageMock).toHaveBeenCalledWith(42, {
      type: 'chatbrowserx.tool.page-action.request',
      action: 'scroll',
      sid: 's_1',
      ref: 'e3',
      direction: 'down',
      amount: 320,
    });
  });

  it('tells the model to refresh interactable refs after scrolling', async () => {
    const definition = await createPageScrollTool().definition();

    expect(definition?.function.description).toContain('After scrolling');
    expect(definition?.function.description).toContain('get_current_page_elements');
    expect(definition?.function.description).toContain('scrolled=true/false');
    expect(definition?.function.description).toContain('canScrollMore=true/false');
    expect(definition?.function.description).toContain('If scrolled=true');
    expect(definition?.function.description).toContain('do not answer from the pre-scroll snapshot');
    expect(definition?.function.description).toContain('continue the observe-scroll-observe loop while canScrollMore=true');
    expect(definition?.function.description).not.toContain('visible content remains relevant');
    expect(definition?.function.description).toContain('For whole-page or document-level analysis requests');
    expect(definition?.function.description).toContain('final answer while canScrollMore=true');
    expect(definition?.function.description).toContain('bottom proof');
    expect(definition?.function.description).toContain('canScrollMore=false or scrolled=false');
    expect(definition?.function.description).toContain('After scrolled=false, refreshing is usually unnecessary');
    expect(definition?.function.description).toContain('unless async content may have changed');
    expect(definition?.function.description).toContain('viewport center');
    expect(definition?.function.description).toContain('does not switch to unrelated scrollareas');
  });

  it('guides the model to infer human-sized scroll amounts from the visible area', async () => {
    const definition = await createPageScrollTool().definition();
    const parameters = definition?.function.parameters as { properties: { amount?: { description?: string } } } | undefined;
    const amountProperty = parameters?.properties.amount;
    const scrollGuidance = `${definition?.function.description ?? ''} ${amountProperty?.description ?? ''}`;

    expect(scrollGuidance).toContain('Prefer omitting amount');
    expect(scrollGuidance).toContain('visible height');
    expect(scrollGuidance).toContain('avoid jumping past');
    expect(amountProperty?.description ?? '').not.toMatch(/\d/);
  });

  it('guides the model to avoid oscillating scroll direction during page analysis', async () => {
    const definition = await createPageScrollTool().definition();
    const description = definition?.function.description ?? '';

    expect(description).toContain('stable scan direction');
    expect(description).toContain('do not alternate between down and up');
    expect(description).toContain('Use the opposite direction only');
  });

  it('guides the model to scroll option popups instead of guessing missing selections', async () => {
    const definition = await createPageScrollTool().definition();
    const description = definition?.function.description ?? '';

    expect(description).toContain('dropdown/listbox/menu/cascader/picker option searches');
    expect(description).toContain('scroll the popup/list scrollarea');
    expect(description).toContain('desired option is not visible');
    expect(description).toContain('stop instead of clicking nearby options');
  });

  it('describes action verification state in click and type tools', async () => {
    const clickDefinition = await createPageClickTool().definition();
    const typeDefinition = await createPageTypeTool().definition();

    expect(clickDefinition?.function.description).toContain('before/after state');
    expect(typeDefinition?.function.description).toContain('before/after input state');
  });

  it('warns against read-only analysis clicks and stale snapshot retries', async () => {
    const clickDefinition = await createPageClickTool().definition();
    const description = clickDefinition?.function.description ?? '';

    expect(description).toContain('For read-only page analysis');
    expect(description).toContain('do not click navigation, outline, menu, toolbar, or AI summary controls');
    expect(description).toContain('PAGE_ACTION_SNAPSHOT_EXPIRED');
    expect(description).toContain('get_current_page_elements');
    expect(description).toContain('latest sid/ref');
  });

  it('validates required page action arguments before sending messages', async () => {
    await expect(createPageClickTool().invoke(undefined, { ref: 'e1' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:sid');
    await expect(createPageTypeTool().invoke(undefined, { sid: 's_latest', ref: 'e1' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:text');
    await expect(createPageDragTool().invoke(undefined, { sid: 's_latest', fromRef: 'e1' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:toRef');
    await expect(createPageScrollTool().invoke(undefined, { direction: 'sideways' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:direction');
  });
});
