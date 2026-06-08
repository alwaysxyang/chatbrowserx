import { readOptionalBoolean, readRequiredRawString } from '../shared/tool-arguments';
import { resolveToolTabId } from '../shared/tab-message-tool';
import { createObjectToolDefinition } from '../shared/tool-definition';
import { registerTool, type InvokeContext, type LlmToolModule } from '../tool-registry';

interface BrowserTabInfo {
  id?: number;
  windowId?: number;
  index?: number;
  active?: boolean;
  highlighted?: boolean;
  pinned?: boolean;
  title?: string;
  url?: string;
  pendingUrl?: string;
  status?: chrome.tabs.Tab['status'];
  discarded?: boolean;
  audible?: boolean;
  muted?: boolean;
  incognito?: boolean;
}

const tabIdSchema = {
  type: 'integer',
  minimum: 1,
  description: 'Target tab id. Defaults to the request-bound tab, then the active tab.',
};

const urlSchema = {
  type: 'string',
  description: 'Target URL.',
};

/**
 * Assigns a compact tab field only when Chrome returned a defined value.
 *
 * @param tabInfo - Compact tab object being built.
 * @param key - Output field name.
 * @param value - Chrome tab field value.
 */
function setDefinedTabField<TKey extends keyof BrowserTabInfo>(
  tabInfo: BrowserTabInfo,
  key: TKey,
  value: BrowserTabInfo[TKey] | undefined,
): void {
  if (value !== undefined) {
    tabInfo[key] = value;
  }
}

/**
 * Converts a Chrome tab object into the compact payload exposed to the model.
 *
 * @param tab - Chrome tab returned by the Tabs API.
 * @returns Compact, serializable tab metadata.
 */
function toBrowserTabInfo(tab: chrome.tabs.Tab): BrowserTabInfo {
  const tabInfo: BrowserTabInfo = {};

  setDefinedTabField(tabInfo, 'id', tab.id);
  setDefinedTabField(tabInfo, 'windowId', tab.windowId);
  setDefinedTabField(tabInfo, 'index', tab.index);
  setDefinedTabField(tabInfo, 'active', tab.active);
  setDefinedTabField(tabInfo, 'highlighted', tab.highlighted);
  setDefinedTabField(tabInfo, 'pinned', tab.pinned);
  setDefinedTabField(tabInfo, 'title', tab.title);
  setDefinedTabField(tabInfo, 'url', tab.url);
  setDefinedTabField(tabInfo, 'pendingUrl', tab.pendingUrl);
  setDefinedTabField(tabInfo, 'status', tab.status);
  setDefinedTabField(tabInfo, 'discarded', tab.discarded);
  setDefinedTabField(tabInfo, 'audible', tab.audible);
  setDefinedTabField(tabInfo, 'muted', tab.mutedInfo?.muted);
  setDefinedTabField(tabInfo, 'incognito', tab.incognito);

  return tabInfo;
}

/**
 * Ensures a Tabs API update returned a tab object before serializing it.
 *
 * @param tab - Tab returned by Chrome, if available.
 * @param operation - Operation name used in the error code.
 * @returns The concrete Chrome tab.
 */
function requireUpdatedTab(tab: chrome.tabs.Tab | undefined, operation: string): chrome.tabs.Tab {
  if (!tab) {
    throw new Error(`BROWSER_TAB_UNAVAILABLE:${operation}`);
  }

  return tab;
}

/**
 * Reads an optional positive integer tab id from tool arguments.
 *
 * @param argumentsObject - Raw tool invocation arguments.
 * @param key - Argument key to read.
 * @returns The tab id when supplied.
 */
function readOptionalTabId(argumentsObject: Record<string, unknown>, key: string): number | undefined {
  const value = argumentsObject[key];

  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }

  return value;
}

/**
 * Reads a required positive integer tab id from tool arguments.
 *
 * @param argumentsObject - Raw tool invocation arguments.
 * @param key - Argument key to read.
 * @returns The required tab id.
 */
function readRequiredTabId(argumentsObject: Record<string, unknown>, key: string): number {
  const tabId = readOptionalTabId(argumentsObject, key);

  if (tabId === undefined) {
    throw new Error(`TOOL_ARGUMENT_INVALID:${key}`);
  }

  return tabId;
}

/**
 * Reads a required URL argument using the shared tool argument error shape.
 *
 * @param argumentsObject - Raw tool invocation arguments.
 * @returns The required URL string.
 */
function readRequiredUrl(argumentsObject: Record<string, unknown>): string {
  return readRequiredRawString(argumentsObject, 'url').trim();
}

/**
 * Resolves the target tab id from arguments, request context, or active tab fallback.
 *
 * @param context - Optional tool invocation context.
 * @param argumentsObject - Raw tool invocation arguments.
 * @returns The tab id to operate on.
 */
async function resolveBrowserTabId(
  context: InvokeContext | undefined,
  argumentsObject: Record<string, unknown>,
): Promise<number> {
  return readOptionalTabId(argumentsObject, 'tabId') ?? await resolveToolTabId(context);
}

/**
 * Creates the browser tab listing LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserListTabsTool(): LlmToolModule {
  return {
    name: () => 'browser_list_tabs',
    definition: () => createObjectToolDefinition(
      'browser_list_tabs',
      'List browser tabs and return compact tab metadata. This tool does not read page content or access the DOM.',
    ),
    invoke: async () => {
      const tabs = await chrome.tabs.query({});
      return { tabs: tabs.map(toBrowserTabInfo) };
    },
  };
}

/**
 * Creates the browser tab lookup LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserGetTabTool(): LlmToolModule {
  return {
    name: () => 'browser_get_tab',
    definition: () => createObjectToolDefinition(
      'browser_get_tab',
      'Get compact metadata for one browser tab. Defaults to the request-bound tab, then the active tab.',
      { tabId: tabIdSchema },
    ),
    invoke: async (context, argumentsObject) => {
      const tabId = await resolveBrowserTabId(context, argumentsObject);
      const tab = await chrome.tabs.get(tabId);
      return { tab: toBrowserTabInfo(tab) };
    },
  };
}

/**
 * Creates the browser tab opener LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserOpenTabTool(): LlmToolModule {
  return {
    name: () => 'browser_open_tab',
    definition: () => createObjectToolDefinition(
      'browser_open_tab',
      'Open a new browser tab and return compact tab metadata.',
      {
        url: urlSchema,
        active: {
          type: 'boolean',
          description: 'Whether the new tab should become active. Defaults to true.',
        },
      },
      ['url'],
    ),
    invoke: async (_context, argumentsObject) => {
      const url = readRequiredUrl(argumentsObject);
      const active = readOptionalBoolean(argumentsObject, 'active') ?? true;
      const tab = await chrome.tabs.create({ url, active });
      return { tab: toBrowserTabInfo(tab) };
    },
  };
}

/**
 * Creates the browser tab switcher LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserSwitchTabTool(): LlmToolModule {
  return {
    name: () => 'browser_switch_tab',
    definition: () => createObjectToolDefinition(
      'browser_switch_tab',
      'Make a browser tab active. Defaults to the request-bound tab, then the active tab.',
      { tabId: tabIdSchema },
    ),
    invoke: async (context, argumentsObject) => {
      const tabId = await resolveBrowserTabId(context, argumentsObject);
      const tab = requireUpdatedTab(await chrome.tabs.update(tabId, { active: true }), 'switch');
      return { tab: toBrowserTabInfo(tab) };
    },
  };
}

/**
 * Creates the browser tab closer LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserCloseTabTool(): LlmToolModule {
  return {
    name: () => 'browser_close_tab',
    definition: () => createObjectToolDefinition(
      'browser_close_tab',
      'Close an explicitly specified browser tab. Requires tabId to avoid accidentally closing the current page.',
      {
        tabId: {
          ...tabIdSchema,
          description: 'Explicit tab id to close.',
        },
      },
      ['tabId'],
    ),
    invoke: async (_context, argumentsObject) => {
      const tabId = readRequiredTabId(argumentsObject, 'tabId');
      await chrome.tabs.remove(tabId);
      return { ok: true, tabId, closed: true };
    },
  };
}

/**
 * Creates the browser tab reload LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserReloadTabTool(): LlmToolModule {
  return {
    name: () => 'browser_reload_tab',
    definition: () => createObjectToolDefinition(
      'browser_reload_tab',
      'Reload a browser tab. Defaults to the request-bound tab, then the active tab.',
      {
        tabId: tabIdSchema,
        bypassCache: {
          type: 'boolean',
          description: 'Whether to bypass the browser cache during reload.',
        },
      },
    ),
    invoke: async (context, argumentsObject) => {
      const tabId = await resolveBrowserTabId(context, argumentsObject);
      const bypassCache = readOptionalBoolean(argumentsObject, 'bypassCache');
      await chrome.tabs.reload(tabId, bypassCache === undefined ? {} : { bypassCache });
      return { ok: true, tabId, reloaded: true };
    },
  };
}

/**
 * Creates the browser tab navigation LLM tool.
 *
 * @returns The registered LLM tool module.
 */
export function createBrowserNavigateTabTool(): LlmToolModule {
  return {
    name: () => 'browser_navigate_tab',
    definition: () => createObjectToolDefinition(
      'browser_navigate_tab',
      'Navigate a browser tab to a URL. Defaults to the request-bound tab, then the active tab.',
      {
        tabId: tabIdSchema,
        url: urlSchema,
      },
      ['url'],
    ),
    invoke: async (context, argumentsObject) => {
      const tabId = await resolveBrowserTabId(context, argumentsObject);
      const url = readRequiredUrl(argumentsObject);
      const tab = requireUpdatedTab(await chrome.tabs.update(tabId, { url }), 'navigate');
      return { tab: toBrowserTabInfo(tab) };
    },
  };
}

registerTool(createBrowserListTabsTool());
registerTool(createBrowserGetTabTool());
registerTool(createBrowserOpenTabTool());
registerTool(createBrowserSwitchTabTool());
registerTool(createBrowserCloseTabTool());
registerTool(createBrowserReloadTabTool());
registerTool(createBrowserNavigateTabTool());
