import { describe, expect, it, vi } from 'vitest';
import { readCurrentPageContent, registerGetPageContentToolListener } from '../../../src/ui/tools/get-page-content-tool';

describe('ui get page content tool', () => {
  it('extracts title, url, and innerText from the current page', () => {
    const body = Object.create(HTMLElement.prototype) as HTMLElement;
    Object.defineProperty(body, 'innerText', {
      configurable: true,
      value: 'Line 1\nLine 2',
    });

    const pageContent = readCurrentPageContent(
      {
        title: 'Current page',
        body,
      } as Document,
      { href: 'https://example.com/page' } as Location,
    );

    expect(pageContent).toEqual({
      title: 'Current page',
      url: 'https://example.com/page',
      content: 'Line 1\nLine 2',
    });
  });

  it('registers a listener that responds with page content payload', () => {
    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>;

    document.title = 'Current page';
    Object.defineProperty(document.body, 'innerText', {
      configurable: true,
      value: 'Page body',
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { href: 'https://example.com/page' },
    });

    registerGetPageContentToolListener();

    const listener = addListenerMock.mock.calls[0]?.[0];
    const sendResponse = vi.fn();

    const handled = listener?.(
      { type: 'chatbrowserx.tool.get-page-content.request' },
      undefined,
      sendResponse,
    );

    expect(handled).toBe(false);
    expect(sendResponse).toHaveBeenCalledWith({
      title: 'Current page',
      url: 'https://example.com/page',
      content: 'Page body',
    });
  });
});
