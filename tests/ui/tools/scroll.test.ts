import { afterEach, describe, expect, it, vi } from 'vitest';
import { setCurrentUiLanguage } from '../../../src/shared/i18n/current-language';
import { findMainScrollContainer, scanPage } from '../../../src/ui/tools/scroll';

describe('scroll helper', () => {
  afterEach(() => {
    setCurrentUiLanguage('zh');
    document.body.innerHTML = '';
  });

  it('scrolls to the bottom, shows translated hint, and resolves callback result', async () => {
    setCurrentUiLanguage('en');

    const documentObject = document.implementation.createHTMLDocument('scroll');
    const scrollHost = documentObject.documentElement;
    let scrollHeight = 1200;

    Object.defineProperty(scrollHost, 'clientHeight', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(scrollHost, 'scrollHeight', {
      configurable: true,
      get: () => scrollHeight,
    });
    Object.defineProperty(scrollHost, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 200,
    });
    Object.defineProperty(documentObject, 'scrollingElement', {
      configurable: true,
      value: scrollHost,
    });
    Object.defineProperty(documentObject.documentElement, 'scrollHeight', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(documentObject.body, 'scrollHeight', {
      configurable: true,
      get: () => 400,
    });

    const indicatorTexts: string[] = [];
    const scrollToMock = vi.fn(({ top }: { top: number }) => {
      scrollHost.scrollTop = top;
      scrollHeight = scrollHeight === 1200 ? 1800 : 1800;
    });

    const result = await scanPage({
      documentObject,
      windowObject: { scrollTo: scrollToMock } as unknown as Window,
      delayMs: 0,
      maxStableIterations: 2,
      callback: async () => 'done',
      onStep: () => {
        indicatorTexts.push(
          documentObject.querySelector('[data-testid="tool-scrolling-toast"]')?.textContent ?? '',
        );
      },
    });

    expect(result).toBe('done');
    expect(scrollToMock).toHaveBeenCalled();
    expect(scrollToMock.mock.calls[0]?.[0]).toMatchObject({ top: 0 });
    expect(scrollToMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(scrollToMock.mock.calls.at(-1)?.[0]).toMatchObject({ top: 200 });
    expect(scrollHost.scrollTop).toBe(200);
    expect(indicatorTexts).toContain('Scrolling…');
    expect(documentObject.querySelector('[data-testid="tool-scrolling-toast"]')).toBeNull();
  });

  it('stops scanning early when onStep returns false', async () => {
    const documentObject = document.implementation.createHTMLDocument('scan');
    const scrollHost = documentObject.documentElement;

    Object.defineProperty(scrollHost, 'clientHeight', {
      configurable: true,
      get: () => 400,
    });
    Object.defineProperty(scrollHost, 'scrollHeight', {
      configurable: true,
      get: () => 1600,
    });
    Object.defineProperty(scrollHost, 'scrollTop', {
      configurable: true,
      writable: true,
      value: 0,
    });
    Object.defineProperty(documentObject, 'scrollingElement', {
      configurable: true,
      value: scrollHost,
    });

    const scrollToMock = vi.fn(({ top }: { top: number }) => {
      scrollHost.scrollTop = top;
    });
    const onStep = vi.fn(() => false);

    await scanPage({
      documentObject,
      windowObject: { scrollTo: scrollToMock } as unknown as Window,
      delayMs: 0,
      callback: async () => 'done',
      onStep,
    });

    expect(onStep).toHaveBeenCalledTimes(1);
    expect(scrollToMock).toHaveBeenCalledTimes(2);
    expect(scrollToMock.mock.calls[0]?.[0]).toMatchObject({ top: 0 });
    expect(scrollToMock.mock.calls[1]?.[0]).toMatchObject({ top: 0 });
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
      windowObject: { scrollTo: vi.fn(), scrollBy: vi.fn() } as unknown as Window,
      delayMs: 0,
      maxIterations: 1,
      callback: async () => 'done',
      onStep: () => true,
    });

    expect(scrollByMock).toHaveBeenCalledWith(0, 400);
    expect(scrollHost.scrollTop).toBe(300);
  });
});
