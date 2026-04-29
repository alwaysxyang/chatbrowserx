import { translateMessage } from '../../../shared/i18n/i18n';

const toolScrollingToastTestId = 'tool-scrolling-toast';

interface ScrollContainerInfo {
  element: Window | HTMLElement;
  scrollHeight: number;
  clientHeight: number;
}

function waitForDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

function getScrollingElement(documentObject: Document): HTMLElement | null {
  return (documentObject.scrollingElement as HTMLElement | null) ?? documentObject.documentElement ?? documentObject.body;
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  return (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') && element.scrollHeight > element.clientHeight;
}

export function findMainScrollContainer(documentObject: Document = document): ScrollContainerInfo {
  if (documentObject.documentElement.scrollHeight > window.innerHeight + 10) {
    return {
      element: window,
      scrollHeight: documentObject.documentElement.scrollHeight,
      clientHeight: window.innerHeight,
    };
  }

  if (documentObject.body.scrollHeight > window.innerHeight + 10 && documentObject.body.style.overflowY !== 'hidden') {
    return {
      element: window,
      scrollHeight: documentObject.body.scrollHeight,
      clientHeight: window.innerHeight,
    };
  }

  const candidates = Array.from(documentObject.querySelectorAll<HTMLElement>('*'));
  let bestCandidate: HTMLElement | null = null;
  let maxScore = 0;

  candidates.forEach((element) => {
    if (!isScrollableElement(element)) {
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
    element: window,
    scrollHeight: scrollingElement?.scrollHeight ?? 0,
    clientHeight: scrollingElement?.clientHeight ?? window.innerHeight,
  };
}

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

interface ScanPageOptions<T> {
  callback: () => Promise<T> | T;
  documentObject?: Document;
  windowObject?: Window;
  delayMs?: number;
  maxIterations?: number;
  maxStableIterations?: number;
  onStep?: (scrollTop: number) => boolean | void | Promise<boolean | void>;
}

export async function scanPage<T>({
  callback,
  documentObject = document,
  windowObject = window,
  delayMs = 300,
  maxIterations = 128,
  maxStableIterations = 3,
  onStep,
}: ScanPageOptions<T>): Promise<T> {
  const { element: scrollTarget } = findMainScrollContainer(documentObject);
  const getScrollY = () => {
    if (scrollTarget === windowObject) return windowObject.scrollY;
    return (scrollTarget as HTMLElement).scrollTop;
  };
  const getScrollHeight = () => {
    if (scrollTarget === windowObject) {
      return documentObject.documentElement.scrollHeight;
    }
    return (scrollTarget as HTMLElement).scrollHeight;
  };
  const getClientHeight = () => {
    if (scrollTarget === windowObject) return windowObject.innerHeight;
    return (scrollTarget as HTMLElement).clientHeight;
  };
  const setScrollY = (y: number) => {
    if (scrollTarget === windowObject) windowObject.scrollTo(0, y);
    else (scrollTarget as HTMLElement).scrollTop = y;
  };
  const doScrollBy = (y: number) => {
    if (scrollTarget === windowObject) windowObject.scrollBy(0, y);
    else (scrollTarget as HTMLElement).scrollBy(0, y);
  };

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
  const initialScrollTop = getScrollY();
  let lastScrollY = -1;
  let noProgressCount = 0;
  try {
    setScrollY(0);
    await waitForDelay(delayMs);

    for (let iteration = 0; iteration < maxIterations; iteration += 1) {
      const currentY = getScrollY();
      const currentScrollHeight = getScrollHeight();
      const currentClientHeight = getClientHeight();

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

      if (currentY + currentClientHeight >= currentScrollHeight - 10) {
        break;
      }

      doScrollBy(currentClientHeight);
      await waitForDelay(delayMs);
    }

    return await callback();
  } finally {
    setScrollY(initialScrollTop);
    toast.remove();
  }
}
