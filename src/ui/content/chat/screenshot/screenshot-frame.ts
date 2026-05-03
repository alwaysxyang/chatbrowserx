const scrollSettleDelayMs = 30;
const imageLoadTimeoutMs = 500;
const allImagesTimeoutMs = 1000;
const renderCompletionDelayMs = 100;

/**
 * Wait for a fixed delay.
 *
 * @param delayMs - The delay duration in milliseconds
 */
function waitForDelay(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Wait for one visible image to load or fail, bounded by a timeout.
 *
 * @param image - The image element to observe
 */
function waitForVisibleImage(image: HTMLImageElement): Promise<void> {
  if (image.complete) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timeout);
      image.removeEventListener('load', done);
      image.removeEventListener('error', done);
      resolve();
    };
    const timeout = setTimeout(done, imageLoadTimeoutMs);

    image.addEventListener('load', done);
    image.addEventListener('error', done);
  });
}

/**
 * Check whether an image intersects the current viewport.
 *
 * @param image - The image element to inspect
 * @returns True when any vertical part of the image is visible
 */
function isImageInViewport(image: HTMLImageElement): boolean {
  const rect = image.getBoundingClientRect();
  return rect.top < window.innerHeight && rect.bottom > 0;
}

/**
 * Wait for two animation frames so layout and scroll position settle.
 */
export function waitForScreenshotFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

/**
 * Wait for images in the viewport to load and page to stabilize before taking a screenshot.
 * This prevents images from being cut off when scrolling quickly during long screenshots.
 */
export async function waitForScreenshotStable(): Promise<void> {
  await waitForScreenshotFrame();
  await waitForDelay(scrollSettleDelayMs);

  const visibleImages = Array.from(document.querySelectorAll('img')).filter(isImageInViewport);
  const imageLoadPromises = visibleImages.map(waitForVisibleImage);

  await Promise.race([Promise.all(imageLoadPromises), waitForDelay(allImagesTimeoutMs)]);
  await waitForDelay(renderCompletionDelayMs);
}
