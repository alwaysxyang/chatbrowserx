/**
 * Reads the current page content for Ask AI without scrolling.
 *
 * This is best-effort and intentionally avoids complex crawling. It relies on the current
 * DOM state and truncates content to control prompt size.
 *
 * @param maxChars - Maximum number of characters to return for the page text.
 * @returns Title, URL, and extracted page text.
 */
export function readCurrentPageText(maxChars: number): { title: string; url: string; text: string } {
  const title = document.title || '';
  const url = window.location.href || '';
  const raw = document.body?.innerText || '';
  const text = raw.length > maxChars ? raw.slice(0, maxChars) : raw;
  return { title, url, text };
}

