import {
  isGetPageContentToolRequestMessage,
  type GetPageContentToolPayload,
} from '../../shared/types/tool';
import { readPageContent } from './shared';

export async function readCurrentPageContent(
    documentObject: Document = document,
    locationObject: Location = window.location,
    windowObject: Window = window,
): Promise<GetPageContentToolPayload> {
  const pageContent = {
    title: documentObject.title,
    url: locationObject.href,
    content: '',
  };
  return ({
    ...pageContent,
    content: await readPageContent(documentObject, windowObject),
  });
}

export function registerGetPageContentToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isGetPageContentToolRequestMessage(message)) {
      return undefined;
    }

    void readCurrentPageContent(document, window.location, window).then((response) => {
      sendResponse(response);
    });

    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
}
