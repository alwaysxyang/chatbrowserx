import { vi } from 'vitest';

/**
 * Creates a deterministic DOMRect-like value for geometry tests.
 *
 * @param x - Left coordinate.
 * @param y - Top coordinate.
 * @param width - Rectangle width.
 * @param height - Rectangle height.
 * @returns A DOMRect-compatible object.
 */
export function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

/**
 * Mocks an element's bounding rectangle.
 *
 * @param element - Element whose geometry should be mocked.
 * @param rect - Rectangle returned by getBoundingClientRect.
 */
export function setRect(element: Element, rect: DOMRect): void {
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(rect);
}

/**
 * Replaces document.elementFromPoint with a controllable mock.
 *
 * @param documentObject - Document whose hit testing should be mocked.
 * @param element - Optional element returned by default.
 * @returns The elementFromPoint mock.
 */
export function spyElementFromPoint(documentObject: Document, element?: Element): ReturnType<typeof vi.fn> {
  const mock = vi.fn(() => element ?? null);
  Object.defineProperty(documentObject, 'elementFromPoint', {
    configurable: true,
    value: mock,
  });

  return mock;
}

/**
 * Sets viewport dimensions for geometry-sensitive tests.
 *
 * @param width - Viewport width.
 * @param height - Viewport height.
 */
export function setViewportSize(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
}

/**
 * Replaces window.scrollBy with a mock and returns it for assertions.
 *
 * @returns The installed scrollBy mock.
 */
export function mockWindowScrollBy(): ReturnType<typeof vi.fn> {
  const scrollByMock = vi.fn();
  Object.defineProperty(window, 'scrollBy', { configurable: true, value: scrollByMock });
  return scrollByMock;
}

/**
 * Gives an element deterministic scroll metrics in jsdom.
 *
 * @param element - Element whose scroll metrics should be mocked.
 */
export function setScrollableMetrics(element: HTMLElement): void {
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: 400 });
  Object.defineProperty(element, 'scrollHeight', { configurable: true, value: 1200 });
  Object.defineProperty(element, 'scrollTop', { configurable: true, writable: true, value: 0 });
}
