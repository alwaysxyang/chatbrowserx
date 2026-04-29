import { afterEach, describe, expect, it, vi } from 'vitest';
import { readCurrentPageContent, registerGetPageContentToolListener } from '../../../src/ui/tools/get-page-content-tool';
import * as contentReader from '../../../src/ui/tools/page-content/content-reader';

describe('ui get page content tool', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('extracts title, url, and innerText from the current page', async () => {
    const documentObject = document.implementation.createHTMLDocument('Current page');
    Object.defineProperty(documentObject.body, 'innerText', {
      configurable: true,
      value: 'Line 1\nLine 2',
    });

    const pageContent = await readCurrentPageContent(
      documentObject,
      { href: 'https://example.com/page' } as Location,
      { scrollTo: vi.fn() } as unknown as Window,
    );

    expect(pageContent).toEqual({
      title: 'Current page',
      url: 'https://example.com/page',
      content: 'Line 1\nLine 2',
    });
  });

  it('reads body text through scroll capture flow', async () => {
    const readPageContentSpy = vi.spyOn(contentReader, 'readPageContent').mockResolvedValue('Scrolled text');
    const documentObject = document.implementation.createHTMLDocument('Current page');

    const pageContent = await readCurrentPageContent(
      documentObject,
      { href: 'https://example.com/page' } as Location,
      { scrollTo: vi.fn() } as unknown as Window,
    );

    expect(readPageContentSpy).toHaveBeenCalledWith(documentObject, expect.anything());
    expect(pageContent.content).toBe('Scrolled text');
  });

  it('registers a listener that responds with page content payload', async () => {
    const addListenerMock = chrome.runtime.onMessage.addListener as unknown as ReturnType<typeof vi.fn>;
    const readPageContentSpy = vi.spyOn(contentReader, 'readPageContent').mockResolvedValue('Page body');

    document.title = 'Current page';
    window.history.replaceState({}, '', '/page');

    registerGetPageContentToolListener();

    const listener = addListenerMock.mock.calls[0]?.[0];
    const sendResponse = vi.fn();

    const handled = listener?.(
      { type: 'chatbrowserx.tool.get-page-content.request' },
      undefined,
      sendResponse,
    );

    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(handled).toBe(true);
    expect(readPageContentSpy).toHaveBeenCalled();
    expect(sendResponse).toHaveBeenCalledWith({
      title: 'Current page',
      url: window.location.href,
      content: 'Page body',
    });
  });
});
