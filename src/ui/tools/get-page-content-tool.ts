import {
  isGetPageContentToolRequestMessage,
  type GetPageContentToolPayload,
} from '../../shared/types/runtime-messages';
import { readBodyInnerText } from './shared';

export function readCurrentPageContent(
  documentObject: Document = document,
  locationObject: Location = window.location,
): GetPageContentToolPayload {
  return {
    title: documentObject.title,
    url: locationObject.href,
    content: readBodyInnerText(documentObject),
  };
}

export function registerGetPageContentToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isGetPageContentToolRequestMessage(message)) {
      return undefined;
    }

    const response = readCurrentPageContent(document, window.location);
    sendResponse(response);
    return false;
  };

  chrome.runtime.onMessage.addListener(listener);
}
