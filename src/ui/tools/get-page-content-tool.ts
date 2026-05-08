import {
  isGetPageContentToolRequestMessage,
  type GetPageContentToolPayload,
} from '../../shared/types/tools';
import { readPageContent } from './page-content/content-reader';

/**
 * Reads the current page metadata and bounded visible text content.
 *
 * @param documentObject - The document to read from.
 * @param locationObject - The location that provides the current URL.
 * @param windowObject - The window used for page scanning.
 * @returns A page-content tool payload.
 */
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

/**
 * Registers the content-side listener for current page content tool requests.
 */
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
