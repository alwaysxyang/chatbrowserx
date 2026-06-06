import {
  isGetPageContentToolRequestMessage,
  type GetPageContentToolPayload,
} from '../../../shared/types/tools';
import {
  hasScrollableContent,
  scanPage,
  type ScanPageOptions,
} from '../shared/page-scanner';

export type PageContentReadOptions = Pick<ScanPageOptions<string>, 'delayMs' | 'maxIterations' | 'maxStableIterations'>;

/**
 * Reads browser-like body text with a test-friendly fallback.
 *
 * @param documentObject - Document to read from.
 * @returns Current body text.
 */
function readBodyText(documentObject: Document): string {
  return documentObject.body?.innerText ?? documentObject.body?.textContent ?? '';
}

/**
 * Adds non-empty first-seen text lines to the collected output.
 *
 * @param text - Raw page text snapshot.
 * @param capturedLines - Lines that have already been emitted.
 * @param orderedLines - Output lines in first-seen order.
 */
function collectTextLines(text: string, capturedLines: Set<string>, orderedLines: string[]): void {
  text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .forEach((line) => {
      if (!capturedLines.has(line)) {
        capturedLines.add(line);
        orderedLines.push(line);
      }
    });
}

/**
 * Checks whether page-level scrolling can reveal more content.
 *
 * @param documentObject - Document to inspect.
 * @param windowObject - Window used for viewport metrics.
 * @returns True when the page has meaningful vertical scrolling.
 */
/**
 * Reads the host page text with the old simple scroll-and-dedupe strategy.
 *
 * @param documentObject - Document to read from.
 * @param windowObject - Window used for page-level scrolling.
 * @param options - Optional scan tuning for tests.
 * @returns Deduplicated current page text.
 */
export async function readPageContent(
  documentObject: Document,
  windowObject: Window = window,
  options: PageContentReadOptions = {},
): Promise<string> {
  const capturedLines = new Set<string>();
  const orderedLines: string[] = [];
  const maxStableTextSnapshots = options.maxStableIterations ?? 3;
  let previousSnapshot = '';
  let stableCount = 0;

  if (!hasScrollableContent(documentObject, windowObject)) {
    collectTextLines(readBodyText(documentObject), capturedLines, orderedLines);
    return orderedLines.join('\n');
  }

  return await scanPage({
    documentObject,
    windowObject,
    ...options,
    onStep: () => {
      const snapshot = readBodyText(documentObject);

      if (snapshot === previousSnapshot) {
        stableCount += 1;
        if (stableCount >= maxStableTextSnapshots) {
          return false;
        }
      } else {
        stableCount = 0;
      }

      previousSnapshot = snapshot;
      collectTextLines(snapshot, capturedLines, orderedLines);
      return true;
    },
    callback: () => orderedLines.join('\n') || readBodyText(documentObject),
  });
}

/**
 * Reads the current page metadata and scanned text content.
 *
 * @param documentObject - Document to read from.
 * @param windowObject - Window that provides URL and scrolling.
 * @param options - Optional scan tuning for tests.
 * @returns A current-page content payload.
 */
export async function readCurrentPageContent(
  documentObject: Document = document,
  windowObject: Window = window,
  options: PageContentReadOptions = {},
): Promise<GetPageContentToolPayload> {
  return {
    title: documentObject.title,
    url: windowObject.location.href,
    content: await readPageContent(documentObject, windowObject, options),
  };
}

/**
 * Registers the content-side listener for current page content tool requests.
 */
export function registerGetPageContentToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isGetPageContentToolRequestMessage(message)) {
      return undefined;
    }

    void readCurrentPageContent(document, window).then(sendResponse);
    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
}
