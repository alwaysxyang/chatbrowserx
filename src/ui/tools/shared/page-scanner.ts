import { translateMessage } from '../../../shared/i18n/i18n';

const toolScrollingToastTestId = 'tool-scrolling-toast';
const scrollBottomTolerance = 10;

export interface ScrollContainerInfo {
  element: Window | HTMLElement;
  scrollHeight: number;
  clientHeight: number;
}

export interface ScanPageOptions<T> {
  callback: () => Promise<T> | T;
  documentObject?: Document;
  windowObject?: Window;
  delayMs?: number;
  maxIterations?: number;
  maxStableIterations?: number;
  onStep?: (scrollTop: number) => boolean | void | Promise<boolean | void>;
}

/**
 * Waits before continuing a scroll scan step.
 *
 * @param delayMs - Delay duration in milliseconds.
 */
function waitForDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

/**
 * Returns the document-level scrolling element.
 *
 * @param documentObject - Document to inspect.
 * @returns The document scroll element or null.
 */
function getScrollingElement(documentObject: Document): HTMLElement | null {
  return (documentObject.scrollingElement as HTMLElement | null) ?? documentObject.documentElement ?? documentObject.body;
}

/**
 * Checks whether an element is a practical vertical scroll container.
 *
 * @param element - Element to inspect.
 * @param windowObject - Window used to read computed style.
 * @returns True when the element can scroll vertically.
 */
function isScrollableElement(element: HTMLElement, windowObject: Window): boolean {
  const style = windowObject.getComputedStyle(element);
  const overflowY = style.overflowY;
  return (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && element.scrollHeight > element.clientHeight;
}

/**
 * Finds the primary scroll target for a page scan.
 *
 * @param documentObject - The document to inspect.
 * @param windowObject - The window that owns the document.
 * @returns The window or nested element that should drive full-page scanning.
 */
export function findMainScrollContainer(documentObject: Document = document, windowObject: Window = window): ScrollContainerInfo {
  if (documentObject.documentElement.scrollHeight > windowObject.innerHeight + scrollBottomTolerance) {
    return {
      element: windowObject,
      scrollHeight: documentObject.documentElement.scrollHeight,
      clientHeight: windowObject.innerHeight,
    };
  }

  if (
    documentObject.body.scrollHeight > windowObject.innerHeight + scrollBottomTolerance
    && documentObject.body.style.overflowY !== 'hidden'
  ) {
    return {
      element: windowObject,
      scrollHeight: documentObject.body.scrollHeight,
      clientHeight: windowObject.innerHeight,
    };
  }

  const candidates = Array.from(documentObject.querySelectorAll<HTMLElement>('*'));
  let bestCandidate: HTMLElement | null = null;
  let maxScore = 0;

  candidates.forEach((element) => {
    if (!isScrollableElement(element, windowObject)) {
      return;
    }

    if (element.clientHeight < 100 || element.clientWidth < 100) {
      return;
    }

    const score = element.scrollHeight * (element.clientWidth || 1);

    if (score > maxScore) {
      maxScore = score;
      bestCandidate = element;
    }
  });

  if (bestCandidate) {
    const candidate = bestCandidate as HTMLElement;

    return {
      element: candidate,
      scrollHeight: candidate.scrollHeight,
      clientHeight: candidate.clientHeight,
    };
  }

  const scrollingElement = getScrollingElement(documentObject);

  return {
    element: windowObject,
    scrollHeight: scrollingElement?.scrollHeight ?? 0,
    clientHeight: scrollingElement?.clientHeight ?? windowObject.innerHeight,
  };
}

/**
 * Checks whether the primary scan target can reveal more vertical content.
 *
 * @param documentObject - Document to inspect.
 * @param windowObject - Window used for viewport metrics.
 * @returns True when scanning should scroll through the page.
 */
export function hasScrollableContent(documentObject: Document = document, windowObject: Window = window): boolean {
  const { scrollHeight, clientHeight } = findMainScrollContainer(documentObject, windowObject);
  return scrollHeight > clientHeight + scrollBottomTolerance;
}

/**
 * Creates a non-interactive status toast while page scanning is in progress.
 *
 * @param documentObject - Document that receives the toast.
 * @param message - Toast text.
 * @returns The created toast element.
 */
function createToolStatusToast(documentObject: Document, message: string): HTMLElement {
  const toast = documentObject.createElement('div');
  toast.dataset.testid = toolScrollingToastTestId;
  toast.setAttribute('data-testid', toolScrollingToastTestId);
  toast.textContent = message;
  toast.style.position = 'fixed';
  toast.style.left = '50%';
  toast.style.top = '18%';
  toast.style.transform = 'translateX(-50%)';
  toast.style.zIndex = '2147483647';
  toast.style.padding = '8px 12px';
  toast.style.borderRadius = '10px';
  toast.style.background = 'rgba(80, 80, 80, 0.88)';
  toast.style.color = '#fff';
  toast.style.fontSize = '12px';
  toast.style.lineHeight = '16px';
  toast.style.boxShadow = '0 6px 18px rgba(0, 0, 0, 0.18)';

  documentObject.body?.appendChild(toast);

  return toast;
}

/**
 * Reads the current vertical scroll offset from a scan target.
 *
 * @param scrollTarget - Window or element being scanned.
 * @param windowObject - Window used when the scan target is the viewport.
 * @returns The current vertical scroll offset.
 */
function getScrollTop(scrollTarget: Window | HTMLElement, windowObject: Window): number {
  if (scrollTarget === windowObject) {
    return windowObject.scrollY;
  }

  return (scrollTarget as HTMLElement).scrollTop;
}

/**
 * Reads the vertical scroll height from a scan target.
 *
 * @param scrollTarget - Window or element being scanned.
 * @param documentObject - Document used when the scan target is the viewport.
 * @param windowObject - Window used to identify viewport scanning.
 * @returns Total vertical scrollable height.
 */
function getScrollHeight(scrollTarget: Window | HTMLElement, documentObject: Document, windowObject: Window): number {
  if (scrollTarget === windowObject) {
    return documentObject.documentElement.scrollHeight;
  }

  return (scrollTarget as HTMLElement).scrollHeight;
}

/**
 * Reads the visible vertical size from a scan target.
 *
 * @param scrollTarget - Window or element being scanned.
 * @param windowObject - Window used when the scan target is the viewport.
 * @returns Visible vertical size for one scan step.
 */
function getClientHeight(scrollTarget: Window | HTMLElement, windowObject: Window): number {
  if (scrollTarget === windowObject) {
    return windowObject.innerHeight;
  }

  return (scrollTarget as HTMLElement).clientHeight;
}

/**
 * Sets the current vertical scroll offset for a scan target.
 *
 * @param scrollTarget - Window or element being scanned.
 * @param windowObject - Window used when the scan target is the viewport.
 * @param scrollTop - Target vertical scroll offset.
 */
function setScrollTop(scrollTarget: Window | HTMLElement, windowObject: Window, scrollTop: number): void {
  if (scrollTarget === windowObject) {
    windowObject.scrollTo(0, scrollTop);
    return;
  }

  (scrollTarget as HTMLElement).scrollTop = scrollTop;
}

/**
 * Scrolls a scan target by one vertical step.
 *
 * @param scrollTarget - Window or element being scanned.
 * @param windowObject - Window used when the scan target is the viewport.
 * @param deltaY - Vertical scroll delta.
 */
function scrollTargetBy(scrollTarget: Window | HTMLElement, windowObject: Window, deltaY: number): void {
  if (scrollTarget === windowObject) {
    windowObject.scrollBy(0, deltaY);
    return;
  }

  (scrollTarget as HTMLElement).scrollBy(0, deltaY);
}

/**
 * Runs a callback after scanning through the page's primary scroll positions.
 *
 * @param options - Scroll scanning options and callbacks.
 * @returns The callback result after scanning completes or stabilizes.
 */
export async function scanPage<T>({
  callback,
  documentObject = document,
  windowObject = window,
  delayMs = 300,
  maxIterations = 128,
  maxStableIterations = 3,
  onStep,
}: ScanPageOptions<T>): Promise<T> {
  const { element: scrollTarget } = findMainScrollContainer(documentObject, windowObject);

  let toast: HTMLElement = createToolStatusToast(documentObject, translateMessage('tools.scroll.loading'));
  if (onStep) {
    const previousOnStep = onStep;
    onStep = async (scrollTop: number): Promise<boolean | void> => {
      toast.remove();
      await new Promise(resolve => requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
      }));
      const result = await previousOnStep(scrollTop);
      toast = createToolStatusToast(documentObject, translateMessage('tools.scroll.loading'));
      return result;
    };
  }
  const initialScrollTop = getScrollTop(scrollTarget, windowObject);
  let lastScrollY = -1;
  let noProgressCount = 0;
  try {
    setScrollTop(scrollTarget, windowObject, 0);
    await waitForDelay(delayMs);

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const currentY = getScrollTop(scrollTarget, windowObject);
      const currentScrollHeight = getScrollHeight(scrollTarget, documentObject, windowObject);
      const currentClientHeight = getClientHeight(scrollTarget, windowObject);

      if (currentY === lastScrollY) {
        noProgressCount += 1;
        if (noProgressCount >= maxStableIterations) {
          break;
        }
      } else {
        noProgressCount = 0;
      }

      lastScrollY = currentY;
      if ((await onStep?.(currentY)) === false) {
        break;
      }

      if (currentY + currentClientHeight >= currentScrollHeight - scrollBottomTolerance) {
        break;
      }

      scrollTargetBy(scrollTarget, windowObject, currentClientHeight);
      await waitForDelay(delayMs);
    }

    return await callback();
  } finally {
    setScrollTop(scrollTarget, windowObject, initialScrollTop);
    toast.remove();
  }
}
