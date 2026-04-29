import {
  isGetPageInteractablesToolRequestMessage,
  isPageActionToolRequestMessage,
} from '../../../shared/types/tools';
import { executePageAction } from './action-executor';
import { readCurrentPageInteractables } from './interactable-scanner';

/**
 * Registers the content-script listener for page interactables tool requests.
 */
export function registerGetPageInteractablesToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isGetPageInteractablesToolRequestMessage(message)) {
      return undefined;
    }

    sendResponse(readCurrentPageInteractables(document, window));
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
  registerGetPageInteractablesToolListener();
  registerPageActionToolListener();
}
