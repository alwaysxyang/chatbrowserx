import { describe, expect, it } from 'vitest';
import {
  createBrowserGetTabTool,
  createBrowserListTabsTool,
  createBrowserNavigateTabTool,
  createBrowserOpenTabTool,
  createBrowserReloadTabTool,
  createBrowserCloseTabTool,
  createBrowserSwitchTabTool,
} from '../../../src/llm/tools/browser-tabs';

describe('browser tab tools', () => {
  it('defines browser tab management tools', async () => {
    const definitions = await Promise.all([
      createBrowserListTabsTool().definition(),
      createBrowserGetTabTool().definition(),
      createBrowserOpenTabTool().definition(),
      createBrowserSwitchTabTool().definition(),
      createBrowserCloseTabTool().definition(),
      createBrowserReloadTabTool().definition(),
      createBrowserNavigateTabTool().definition(),
    ]);

    expect(definitions.map((definition) => definition?.function.name)).toEqual([
      'browser_list_tabs',
      'browser_get_tab',
      'browser_open_tab',
      'browser_switch_tab',
      'browser_close_tab',
      'browser_reload_tab',
      'browser_navigate_tab',
    ]);
    expect(definitions[1]?.function.parameters).toMatchObject({
      properties: { tabId: { type: 'integer' } },
    });
    expect(definitions[2]?.function.parameters).toMatchObject({
      properties: { url: { type: 'string' }, active: { type: 'boolean' } },
      required: ['url'],
    });
  });

  it('lists tabs with compact tab information', async () => {
    const tabsQueryMock = globalThis.__chromeTestUtils.getTabsQueryMock();
    tabsQueryMock.mockResolvedValue([
      { id: 11, windowId: 1, index: 0, active: true, title: 'Docs', url: 'https://example.com/a', status: 'complete' },
      { id: 12, windowId: 1, index: 1, active: false, title: 'Search', url: 'https://example.com/b', pinned: true },
    ]);

    await expect(createBrowserListTabsTool().invoke(undefined, {})).resolves.toEqual({
      tabs: [
        { id: 11, windowId: 1, index: 0, active: true, title: 'Docs', url: 'https://example.com/a', status: 'complete' },
        { id: 12, windowId: 1, index: 1, active: false, title: 'Search', url: 'https://example.com/b', pinned: true },
      ],
    });
    expect(tabsQueryMock).toHaveBeenCalledWith({});
  });

  it('gets an explicit tab or falls back to the request-bound tab', async () => {
    const tabsGetMock = globalThis.__chromeTestUtils.getTabsGetMock();
    tabsGetMock.mockResolvedValueOnce({ id: 22, title: 'Explicit', url: 'https://example.com/explicit' });
    tabsGetMock.mockResolvedValueOnce({ id: 43, title: 'Bound', url: 'https://example.com/bound' });

    await expect(createBrowserGetTabTool().invoke(undefined, { tabId: 22 })).resolves.toEqual({
      tab: { id: 22, title: 'Explicit', url: 'https://example.com/explicit' },
    });
    await expect(createBrowserGetTabTool().invoke({ pageToolTabId: 43 }, {})).resolves.toEqual({
      tab: { id: 43, title: 'Bound', url: 'https://example.com/bound' },
    });
    expect(tabsGetMock).toHaveBeenNthCalledWith(1, 22);
    expect(tabsGetMock).toHaveBeenNthCalledWith(2, 43);
  });

  it('opens a new tab and returns its tab information', async () => {
    const tabsCreateMock = globalThis.__chromeTestUtils.getTabsCreateMock();
    tabsCreateMock.mockResolvedValue({ id: 31, active: false, url: 'https://example.com/new' });

    await expect(createBrowserOpenTabTool().invoke(undefined, {
      url: 'https://example.com/new',
      active: false,
    })).resolves.toEqual({
      tab: { id: 31, active: false, url: 'https://example.com/new' },
    });
    expect(tabsCreateMock).toHaveBeenCalledWith({ url: 'https://example.com/new', active: false });
  });

  it('closes an explicit tab id', async () => {
    const tabsRemoveMock = globalThis.__chromeTestUtils.getTabsRemoveMock();
    tabsRemoveMock.mockResolvedValue(undefined);

    await expect(createBrowserCloseTabTool().invoke(undefined, { tabId: 55 })).resolves.toEqual({
      ok: true,
      tabId: 55,
      closed: true,
    });
    expect(tabsRemoveMock).toHaveBeenCalledWith(55);
  });

  it('switches, reloads, and navigates defaulting to the request-bound tab', async () => {
    const tabsUpdateMock = globalThis.__chromeTestUtils.getTabsUpdateMock();
    const tabsReloadMock = globalThis.__chromeTestUtils.getTabsReloadMock();
    tabsUpdateMock
      .mockResolvedValueOnce({ id: 43, active: true, url: 'https://example.com/current' })
      .mockResolvedValueOnce({ id: 43, active: true, url: 'https://example.com/next' });
    tabsReloadMock.mockResolvedValue(undefined);

    await expect(createBrowserSwitchTabTool().invoke({ pageToolTabId: 43 }, {})).resolves.toEqual({
      tab: { id: 43, active: true, url: 'https://example.com/current' },
    });
    await expect(createBrowserReloadTabTool().invoke({ pageToolTabId: 43 }, { bypassCache: true })).resolves.toEqual({
      ok: true,
      tabId: 43,
      reloaded: true,
    });
    await expect(createBrowserNavigateTabTool().invoke({ pageToolTabId: 43 }, {
      url: 'https://example.com/next',
    })).resolves.toEqual({
      tab: { id: 43, active: true, url: 'https://example.com/next' },
    });

    expect(tabsUpdateMock).toHaveBeenNthCalledWith(1, 43, { active: true });
    expect(tabsReloadMock).toHaveBeenCalledWith(43, { bypassCache: true });
    expect(tabsUpdateMock).toHaveBeenNthCalledWith(2, 43, { url: 'https://example.com/next' });
  });

  it('validates tab ids and required urls', async () => {
    await expect(createBrowserGetTabTool().invoke(undefined, { tabId: 0 })).rejects.toThrow('TOOL_ARGUMENT_INVALID:tabId');
    await expect(createBrowserCloseTabTool().invoke(undefined, {})).rejects.toThrow('TOOL_ARGUMENT_INVALID:tabId');
    await expect(createBrowserOpenTabTool().invoke(undefined, {})).rejects.toThrow('TOOL_ARGUMENT_INVALID:url');
    await expect(createBrowserNavigateTabTool().invoke(undefined, { tabId: 1 })).rejects.toThrow('TOOL_ARGUMENT_INVALID:url');
  });
});
