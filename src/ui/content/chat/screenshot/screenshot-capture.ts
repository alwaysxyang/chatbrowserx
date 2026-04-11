import { clamp, getViewportSize } from './screenshot-selection-geometry';

import {
  type LongScreenshotCaptureArea,
} from './screenshot-scroll-target';
import type { CapturedLongScreenshotChunk, ScreenshotDocumentRange, ScreenshotRect } from './screenshot-types';

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
 * Stitch multiple screenshot data URLs into a single vertical image.
 *
 * @param dataUrls - The ordered screenshot chunks to stitch
 * @returns The stitched image as a data URL
 */
export async function stitchScreenshotDataUrls(dataUrls: string[]): Promise<string> {
  const images = await Promise.all(dataUrls.map(loadImage));
  const width = Math.max(...images.map((image) => image.naturalWidth), 1);
  const height = images.reduce((sum, image) => sum + image.naturalHeight, 0) || 1;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available for screenshot stitching.');
  }

  canvas.width = width;
  canvas.height = height;

  let offsetY = 0;
  images.forEach((image) => {
    context.drawImage(image, 0, offsetY);
    offsetY += image.naturalHeight;
  });

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
 * Find the still-missing logical content ranges for the current long screenshot session.
 *
 * @param range - The currently visible content range
 * @param chunks - The chunks that have already been captured
 * @returns The uncovered content ranges that still need screenshots
 */
export function getUncapturedLongScreenshotSegments(
  range: ScreenshotDocumentRange,
  chunks: CapturedLongScreenshotChunk[],
): ScreenshotDocumentRange[] {
  const sortedChunks = [...chunks].sort((left, right) => left.startY - right.startY);
  let segments: ScreenshotDocumentRange[] = [
    {
      startY: Math.min(range.startY, range.endY),
      endY: Math.max(range.startY, range.endY),
    },
  ];

  sortedChunks.forEach((chunk) => {
    segments = segments.flatMap((segment) => {
      if (chunk.endY <= segment.startY || chunk.startY >= segment.endY) {
        return [segment];
      }

      const nextSegments: ScreenshotDocumentRange[] = [];

      if (chunk.startY > segment.startY) {
        nextSegments.push({ startY: segment.startY, endY: Math.min(chunk.startY, segment.endY) });
      }

      if (chunk.endY < segment.endY) {
        nextSegments.push({ startY: Math.max(chunk.endY, segment.startY), endY: segment.endY });
      }

      return nextSegments.filter((nextSegment) => nextSegment.endY > nextSegment.startY);
    });
  });

  return segments.filter((segment) => segment.endY > segment.startY);
}

/**
 * Capture the currently visible long-screenshot area and crop the requested segments from it.
 *
 * @param captureVisibleTab - The bridge used to capture the current tab viewport
 * @param captureArea - The current viewport crop rectangle and logical content range
 * @param segments - The logical content ranges that still need capturing
 * @returns The captured long-screenshot chunks for the missing ranges
 */
export async function captureLongScreenshotSegments(
  captureVisibleTab: () => Promise<string>,
  captureArea: LongScreenshotCaptureArea,
  segments: ScreenshotDocumentRange[],
): Promise<CapturedLongScreenshotChunk[]> {
  if (!segments.length) {
    return [];
  }

  const dataUrl = await captureVisibleTab();

  return Promise.all(
    segments.map(async (segment) => {
      const startY = Math.min(segment.startY, segment.endY);
      const endY = Math.max(segment.startY, segment.endY);
      const chunkHeight = endY - startY;
      const viewportTop = captureArea.captureRect.top + (startY - captureArea.range.startY);

      return {
        startY,
        endY,
        dataUrl: await cropScreenshotDataUrl(dataUrl, {
          left: captureArea.captureRect.left,
          top: viewportTop,
          width: captureArea.captureRect.width,
          height: chunkHeight,
        }),
      };
    }),
  );
}

/**
 * Stitch ordered long-screenshot chunks into a single output image.
 *
 * @param chunks - The captured long-screenshot chunks
 * @returns The stitched image as a data URL
 */
export async function stitchLongScreenshotChunks(chunks: CapturedLongScreenshotChunk[]): Promise<string> {
  return stitchScreenshotDataUrls(
    [...chunks].sort((left, right) => left.startY - right.startY).map((chunk) => chunk.dataUrl),
  );
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
