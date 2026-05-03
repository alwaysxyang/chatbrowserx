import { runtimeErrorResponse, toRuntimeResponse } from '../shared/types/runtime-messages';

/**
 * Reads the sender tab id or sends a standard runtime error response.
 *
 * @param sender - The runtime message sender.
 * @param sendResponse - The runtime response callback.
 * @returns The tab id when present.
 */
export function getSenderTabIdOrRespond(
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void,
): number | undefined {
  const tabId = sender.tab?.id;
  if (tabId == null) {
    sendResponse(runtimeErrorResponse('No tab ID'));
    return undefined;
  }

  return tabId;
}

/**
 * Sends the result of an async background task through a runtime response callback.
 *
 * @param task - The async task to wrap.
 * @param sendResponse - The runtime response callback.
 */
export function sendAsyncRuntimeResponse<TData>(
  task: Promise<TData>,
  sendResponse: (response?: unknown) => void,
): void {
  void toRuntimeResponse(task).then(sendResponse);
}
