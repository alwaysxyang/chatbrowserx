import { describe, expect, it, vi } from 'vitest';
import {
  createPageClickTool,
  createPageDragTool,
  createPageMouseMoveTool,
  createPageScrollTool,
  createPageTypeTool,
} from '../../../src/llm/tools/page-action-tools';

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
    const tabsQueryMock = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    const tabsSendMessageMock = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;
    tabsQueryMock.mockResolvedValue([{ id: 42 }]);
    tabsSendMessageMock.mockResolvedValue({ ok: true, action: 'click', ref: 'e13' });

    await expect(createPageClickTool().invoke({ sid: 's_latest', ref: 'e13' })).resolves.toEqual({
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
    const tabsQueryMock = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    const tabsSendMessageMock = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;
    tabsQueryMock
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 87 }]);
    tabsSendMessageMock.mockResolvedValue({ ok: true, action: 'click', ref: 'e22' });

    await expect(createPageClickTool().invoke({ sid: 's_1', ref: 'e22' })).resolves.toEqual({
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
    const tabsQueryMock = chrome.tabs.query as unknown as ReturnType<typeof vi.fn>;
    const tabsSendMessageMock = chrome.tabs.sendMessage as unknown as ReturnType<typeof vi.fn>;
    tabsQueryMock.mockResolvedValue([{ id: 42 }]);
    tabsSendMessageMock.mockResolvedValue({ ok: true, action: 'scroll', ref: 'e3' });

    await expect(createPageScrollTool().invoke({ direction: 'down', sid: 's_1', ref: 'e3', amount: 320 })).resolves.toEqual({
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
    expect(definition?.function.description).toContain('get_current_page_interactables');
    expect(definition?.function.description).toContain('scrolled=true/false');
  });

  it('describes action verification state in click and type tools', async () => {
    const clickDefinition = await createPageClickTool().definition();
    const typeDefinition = await createPageTypeTool().definition();

    expect(clickDefinition?.function.description).toContain('before/after state');
    expect(typeDefinition?.function.description).toContain('before/after input state');
  });

  it('validates required page action arguments before sending messages', async () => {
    await expect(createPageClickTool().invoke({ ref: 'e1' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:sid');
    await expect(createPageTypeTool().invoke({ sid: 's_latest', ref: 'e1' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:text');
    await expect(createPageDragTool().invoke({ sid: 's_latest', fromRef: 'e1' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:toRef');
    await expect(createPageScrollTool().invoke({ direction: 'sideways' })).rejects.toThrow('TOOL_ARGUMENT_INVALID:direction');
  });
});
