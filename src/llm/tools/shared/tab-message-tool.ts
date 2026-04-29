import { getActiveTabId } from './active-tab';

/**
 * Sends a tool request message to the active tab content script.
 *
 * @param message - Runtime message payload for the content script.
 * @returns The typed content-script response.
 */
export async function sendActiveTabToolMessage<TResponse>(message: Record<string, unknown>): Promise<TResponse> {
  const tabId = await getActiveTabId();
  return await chrome.tabs.sendMessage(tabId, message) as TResponse;
}
