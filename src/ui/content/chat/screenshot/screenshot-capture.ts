import { clamp, getViewportSize } from './screenshot-selection-geometry';

import type { ScreenshotRect } from './screenshot-types';

/**
 * Load a screenshot image from a data URL.
 *
 * @param dataUrl - The screenshot image as a data URL
 * @returns The loaded image element
 */
function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image.'));
    image.src = dataUrl;
  });
}

/**
 * Clamp a screenshot rectangle to the current viewport bounds.
 *
 * @param rect - The source rectangle in viewport coordinates
 * @param viewport - The viewport dimensions used for clamping
 * @returns A normalized rectangle that stays inside the viewport
 */
function normalizeRect(rect: ScreenshotRect, viewport = getViewportSize()): ScreenshotRect {
  const left = clamp(rect.left, 0, viewport.width - 1);
  const top = clamp(rect.top, 0, viewport.height - 1);
  const width = clamp(rect.width, 1, viewport.width - left);
  const height = clamp(rect.height, 1, viewport.height - top);

  return { left, top, width, height };
}

/**
 * Crop a viewport screenshot down to the requested rectangle.
 *
 * @param dataUrl - The source screenshot data URL
 * @param rect - The viewport rectangle to crop
 * @returns The cropped image as a data URL
 */
export async function cropScreenshotDataUrl(dataUrl: string, rect: ScreenshotRect): Promise<string> {
  const viewport = getViewportSize();
  const normalizedRect = normalizeRect(rect, viewport);
  const image = await loadImage(dataUrl);
  const scaleX = image.naturalWidth / viewport.width || 1;
  const scaleY = image.naturalHeight / viewport.height || 1;
  const outputScale = Math.min(scaleX, scaleY) || 1;
  const sourceLeft = Math.round(normalizedRect.left * scaleX);
  const sourceTop = Math.round(normalizedRect.top * scaleY);
  const sourceWidth = Math.min(
    image.naturalWidth - sourceLeft,
    Math.round(normalizedRect.width * scaleX),
  );
  const sourceHeight = Math.min(
    image.naturalHeight - sourceTop,
    Math.round(normalizedRect.height * scaleY),
  );
  const targetWidth = Math.round(normalizedRect.width * outputScale);
  const targetHeight = Math.round(normalizedRect.height * outputScale);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available for screenshot cropping.');
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.drawImage(
    image,
    sourceLeft,
    sourceTop,
    sourceWidth,
    sourceHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return canvas.toDataURL('image/png');
}

/**
 * Capture and crop the current visible viewport selection.
 *
 * @param captureVisibleTab - The bridge used to capture the current tab viewport
 * @param selection - The selected viewport rectangle
 * @returns The cropped image as a data URL
 */
export async function captureSelectedViewport(
  captureVisibleTab: () => Promise<string>,
  selection: ScreenshotRect,
): Promise<string> {
  const dataUrl = await captureVisibleTab();
  return cropScreenshotDataUrl(dataUrl, selection);
}

/**
 * Create the default screenshot selection rectangle for the current viewport.
 *
 * @returns The default screenshot selection rectangle
 */
export function createDefaultScreenshotSelection(): ScreenshotRect {
  const viewport = getViewportSize();
  const width = Math.max(120, Math.round(viewport.width * 0.62));
  const height = Math.max(120, Math.round(viewport.height * 0.46));

  return {
    left: Math.round((viewport.width - width) / 2),
    top: Math.round((viewport.height - height) / 2),
    width,
    height,
  };
}
