import {
  isGetPageElementsToolRequestMessage,
  isPageActionToolRequestMessage,
} from '../../../shared/types/tools';
import { executePageAction } from './action-executor';
import { readCurrentPageElements } from './page-element-scanner';

/**
 * Registers the content-script listener for page element snapshot tool requests.
 */
export function registerGetPageElementsToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isGetPageElementsToolRequestMessage(message)) {
      return undefined;
    }

    sendResponse(readCurrentPageElements(document, window));
    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
}

/**
 * Registers the content-script listener for page action tool requests.
 */
export function registerPageActionToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isPageActionToolRequestMessage(message)) {
      return undefined;
    }

    void executePageAction(message, document, window).then(sendResponse);
    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
}

/**
 * Registers all content-script page automation tool listeners.
 */
export function registerPageAutomationToolListeners(): void {
  registerGetPageElementsToolListener();
  registerPageActionToolListener();
}
