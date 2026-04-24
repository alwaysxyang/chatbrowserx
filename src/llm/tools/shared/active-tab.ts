/**
 * Reads the first tab ID from a tab query.
 *
 * @param queryInfo - The Chrome tabs query.
 * @returns The first tab ID when available.
 */
async function queryFirstTabId(queryInfo: chrome.tabs.QueryInfo): Promise<number | undefined> {
  const tabs = await chrome.tabs.query(queryInfo);
  return tabs[0]?.id;
}

/**
 * Resolves the active page tab ID or throws a stable tool error code.
 *
 * @returns The active tab ID.
 */
export async function getActiveTabId(): Promise<number> {
  const tabId = await queryFirstTabId({ active: true, currentWindow: true })
    ?? await queryFirstTabId({ active: true, lastFocusedWindow: true })
    ?? await queryFirstTabId({ active: true });

  if (tabId == null) {
    throw new Error('TOOL_TAB_UNAVAILABLE');
  }

  return tabId;
}
