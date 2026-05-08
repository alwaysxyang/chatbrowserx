import { scanPage } from './page-scanner';

/**
 * Reads visible page text, scanning scroll positions to collect stable content.
 *
 * @param documentObject - The document to read from.
 * @param windowObject - The window used for scroll scanning.
 * @returns Bounded page text for the content tool.
 */
export async function readPageContent(
  documentObject: Document,
  windowObject: Window = window,
): Promise<string> {
  const getText = () => documentObject.body?.innerText ?? '';
  const capturedTexts = new Set<string>();
  const orderedContent: string[] = [];
  let previousSnapshot = '';

  return scanPage({
    documentObject,
    windowObject,
    callback: async () => {
      if (orderedContent.length > 0) {
        return orderedContent.join('\n');
      }
      return getText();
    },
    onStep: () => {
      const currentSnapshot = getText();

      if (previousSnapshot && currentSnapshot === previousSnapshot) {
        return false;
      }

      previousSnapshot = currentSnapshot;

      currentSnapshot
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .forEach((line) => {
          if (!capturedTexts.has(line)) {
            capturedTexts.add(line);
            orderedContent.push(line);
          }
        });

      return true;
    },
  });
}
