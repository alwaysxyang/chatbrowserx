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
  // First wait for at least 2 frames to ensure scroll has completed
  await waitForScreenshotFrame();

  // Wait a bit for scroll to settle (shorter than before)
  await new Promise((resolve) => setTimeout(resolve, 30));

  // Wait for images in viewport to load
  const images = Array.from(document.querySelectorAll('img'));
  const viewportImages = images.filter((img) => {
    const rect = img.getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });

  const imageLoadPromises = viewportImages
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise<void>((resolve) => {
          const timeout = setTimeout(() => resolve(), 500); // Max 500ms per image
          img.addEventListener('load', () => {
            clearTimeout(timeout);
            resolve();
          });
          img.addEventListener('error', () => {
            clearTimeout(timeout);
            resolve();
          });
        }),
    );

  // Wait for images to load (with timeout)
  await Promise.race([Promise.all(imageLoadPromises), new Promise((resolve) => setTimeout(resolve, 1000))]);

  // Additional delay to ensure rendering is complete
  await new Promise((resolve) => setTimeout(resolve, 100));
}
