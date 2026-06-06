import { describe, expect, it, vi } from 'vitest';
import { readCurrentPageContent, readPageContent, registerGetPageContentToolListener } from '../../../src/ui/tools/get-page-content';

/**
 * Makes jsdom body text behave like browser innerText.
 */
function setBodyText(text: string): void {
  Object.defineProperty(document.body, 'innerText', {
    configurable: true,
    value: text,
  });
}

describe('get page content content tool', () => {
  it('reads the current page metadata and deduplicated text', async () => {
    document.title = 'Example Doc';
    window.history.pushState(null, '', '/example-doc');
    document.body.innerHTML = '<main>Example</main>';
    setBodyText('Alpha\n\nBeta\nAlpha');

    await expect(readCurrentPageContent(document, window, { delayMs: 0, maxStableIterations: 1 })).resolves.toEqual({
      title: 'Example Doc',
      url: 'http://localhost:3000/example-doc',
      content: 'Alpha\nBeta',
    });
  });

  it('scrolls through the page and restores the initial scroll position', async () => {
    let pageIndex = 0;
    const lines = ['Intro', 'Middle', 'Footer'];
    Object.defineProperty(document.body, 'innerText', {
      configurable: true,
      get: () => lines.slice(0, pageIndex + 1).join('\n'),
    });
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 100 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 300 });
    Object.defineProperty(document.documentElement, 'scrollTop', { configurable: true, writable: true, value: 100 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 100 });
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      get: () => document.documentElement.scrollTop,
    });
    Object.defineProperty(window, 'scrollTo', {
      configurable: true,
      value: vi.fn((_x: number, y: number) => {
        document.documentElement.scrollTop = y;
        pageIndex = Math.min(2, Math.max(0, Math.floor(y / 100)));
      }),
    });
    Object.defineProperty(window, 'scrollBy', {
      configurable: true,
      value: vi.fn((_x: number, y: number) => {
        document.documentElement.scrollTop += y;
        pageIndex = Math.min(2, Math.max(0, Math.floor(document.documentElement.scrollTop / 100)));
      }),
    });

    await expect(readPageContent(document, window, { delayMs: 0, maxStableIterations: 1 })).resolves.toBe('Intro\nMiddle\nFooter');
    expect(document.documentElement.scrollTop).toBe(100);
  });

  it('registers a runtime listener for page content requests', async () => {
    const addListenerMock = globalThis.__chromeTestUtils.getRuntimeOnMessageAddListenerMock();
    registerGetPageContentToolListener();

    const listener = addListenerMock.mock.calls.at(-1)?.[0];
    const sendResponse = vi.fn();

    document.title = 'Runtime Doc';
    setBodyText('Visible text');
    Object.defineProperty(document.documentElement, 'clientHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.documentElement, 'scrollHeight', { configurable: true, value: 800 });
    Object.defineProperty(document.body, 'scrollHeight', { configurable: true, value: 800 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });

    const keepAlive = listener?.({ type: 'chatbrowserx.tool.get-page-content.request' }, {}, sendResponse);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(keepAlive).toBe(true);
    expect(sendResponse).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Runtime Doc',
      content: 'Visible text',
    }));
  });
});
