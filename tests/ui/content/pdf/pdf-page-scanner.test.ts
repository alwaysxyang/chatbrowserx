import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCurrentUiLanguage } from '../../../../src/shared/i18n/current-language';
import { findMainScrollContainer, scanPage } from '../../../../src/ui/content/pdf/pdf-page-scanner';

function mockWindowScroll(initialY = 0) {
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');
  const originalScrollTo = Object.getOwnPropertyDescriptor(window, 'scrollTo');
  const originalScrollBy = Object.getOwnPropertyDescriptor(window, 'scrollBy');
  let scrollY = initialY;
  const scrollToMock = vi.fn((_x: number, y: number) => {
    scrollY = y;
  });
  const scrollByMock = vi.fn((_x: number, y: number) => {
    scrollY += y;
  });

  Object.defineProperty(window, 'scrollY', {
    configurable: true,
    get: () => scrollY,
  });
  Object.defineProperty(window, 'scrollTo', {
    configurable: true,
    value: scrollToMock,
  });
  Object.defineProperty(window, 'scrollBy', {
    configurable: true,
    value: scrollByMock,
  });

  return {
    getScrollY: () => scrollY,
    restore() {
      if (originalScrollY) Object.defineProperty(window, 'scrollY', originalScrollY);
      else Reflect.deleteProperty(window, 'scrollY');
      if (originalScrollTo) Object.defineProperty(window, 'scrollTo', originalScrollTo);
      else Reflect.deleteProperty(window, 'scrollTo');
      if (originalScrollBy) Object.defineProperty(window, 'scrollBy', originalScrollBy);
      else Reflect.deleteProperty(window, 'scrollBy');
    },
    scrollByMock,
    scrollToMock,
  };
}

describe('pdf page scanner', () => {
  afterEach(() => {
    setCurrentUiLanguage('zh');
    document.body.innerHTML = '';
  });

  it('scrolls to the bottom and resolves callback result', async () => {
    setCurrentUiLanguage('en');

    const documentObject = document.implementation.createHTMLDocument('scroll');
    const windowScroll = mockWindowScroll(200);

    Object.defineProperty(documentObject.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 1800,
    });
    Object.defineProperty(documentObject.body, 'scrollHeight', {
      configurable: true,
      get: () => 400,
    });

    try {
      const result = await scanPage({
        documentObject,
        windowObject: window,
        delayMs: 0,
        maxStableIterations: 2,
        callback: async () => 'done',
      });

      expect(result).toBe('done');
      expect(windowScroll.scrollToMock).toHaveBeenCalled();
      expect(windowScroll.scrollToMock.mock.calls[0]).toEqual([0, 0]);
      expect(windowScroll.scrollByMock).toHaveBeenCalled();
      expect(windowScroll.scrollToMock.mock.calls.at(-1)).toEqual([0, 200]);
      expect(windowScroll.getScrollY()).toBe(200);
      expect(documentObject.querySelector('[data-testid="tool-scrolling-toast"]')).toBeNull();
    } finally {
      windowScroll.restore();
    }
  });

  it('stops scanning early when onStep returns false', async () => {
    const documentObject = document.implementation.createHTMLDocument('scan');
    const windowScroll = mockWindowScroll(0);

    Object.defineProperty(documentObject.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 1600,
    });
    const onStep = vi.fn(() => false);

    try {
      await scanPage({
        documentObject,
        windowObject: window,
        delayMs: 0,
        callback: async () => 'done',
        onStep,
      });

      expect(onStep).toHaveBeenCalledTimes(1);
      expect(windowScroll.scrollToMock).toHaveBeenCalledTimes(2);
      expect(windowScroll.scrollToMock.mock.calls[0]).toEqual([0, 0]);
      expect(windowScroll.scrollToMock.mock.calls[1]).toEqual([0, 0]);
    } finally {
      windowScroll.restore();
    }
  });

  it('prefers window scrolling when document root is tall enough', () => {
    const documentObject = document.implementation.createHTMLDocument('root-scroll');
    const innerScrollable = documentObject.createElement('div');

    Object.defineProperty(documentObject.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => window.innerHeight + 200,
    });
    Object.defineProperty(innerScrollable, 'scrollHeight', {
      configurable: true,
      get: () => 5000,
    });
    Object.defineProperty(innerScrollable, 'clientHeight', {
      configurable: true,
      get: () => 300,
    });
    Object.defineProperty(innerScrollable, 'clientWidth', {
      configurable: true,
      get: () => 300,
    });
    innerScrollable.style.overflowY = 'auto';
    documentObject.body.appendChild(innerScrollable);

    const result = findMainScrollContainer(documentObject);

    expect(result.element).toBe(window);
  });

  it('prefers the widest large scrollable area instead of the tallest narrow one', () => {
    const documentObject = document.implementation.createHTMLDocument('inner-scroll');
    const narrowTall = documentObject.createElement('div');
    const wideMain = documentObject.createElement('div');

    Object.defineProperty(documentObject.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => window.innerHeight,
    });

    narrowTall.style.overflowY = 'auto';
    wideMain.style.overflowY = 'auto';

    Object.defineProperty(narrowTall, 'scrollHeight', {
      configurable: true,
      get: () => 8000,
    });
    Object.defineProperty(narrowTall, 'clientHeight', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(narrowTall, 'clientWidth', {
      configurable: true,
      get: () => 80,
    });

    Object.defineProperty(wideMain, 'scrollHeight', {
      configurable: true,
      get: () => 5000,
    });
    Object.defineProperty(wideMain, 'clientHeight', {
      configurable: true,
      get: () => 500,
    });
    Object.defineProperty(wideMain, 'clientWidth', {
      configurable: true,
      get: () => 900,
    });

    documentObject.body.appendChild(narrowTall);
    documentObject.body.appendChild(wideMain);

    const result = findMainScrollContainer(documentObject);

    expect(result.element).toBe(wideMain);
  });

  it('uses element scroll methods for element scroll targets', async () => {
    const documentObject = document.implementation.createHTMLDocument('element-scroll');
    const scrollHost = documentObject.createElement('div');

    scrollHost.style.overflowY = 'auto';
    Object.defineProperty(documentObject.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => window.innerHeight,
    });
    Object.defineProperty(documentObject.body, 'scrollHeight', {
      configurable: true,
      get: () => window.innerHeight,
    });
    Object.defineProperty(scrollHost, 'clientHeight', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(scrollHost, 'clientWidth', {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(scrollHost, 'scrollHeight', {
      configurable: true,
      get: () => 1600,
    });
    Object.defineProperty(scrollHost, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 300,
    });

    const scrollByMock = vi.fn((_x: number, y: number) => {
      scrollHost.scrollTop = Math.min(scrollHost.scrollTop + y, 1200);
    });
    scrollHost.scrollBy = scrollByMock as unknown as HTMLElement['scrollBy'];
    documentObject.body.appendChild(scrollHost);

    await scanPage({
      documentObject,
      windowObject: {
        getComputedStyle: window.getComputedStyle.bind(window),
        innerHeight: window.innerHeight,
        scrollBy: vi.fn(),
        scrollTo: vi.fn(),
        scrollY: 0,
      } as unknown as Window,
      delayMs: 0,
      maxIterations: 1,
      callback: async () => 'done',
      onStep: () => true,
    });

    expect(scrollByMock).toHaveBeenCalledWith(0, 400);
    expect(scrollHost.scrollTop).toBe(300);
  });
});
