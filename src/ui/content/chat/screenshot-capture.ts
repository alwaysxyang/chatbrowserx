export interface ScreenshotRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface ScreenshotDocumentRange {
  startY: number;
  endY: number;
}

export interface CapturedLongScreenshotChunk extends ScreenshotDocumentRange {
  dataUrl: string;
}

function getViewportSize() {
  return {
    width: Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1),
    height: Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1),
  };
}

function waitForFrame(): Promise<void> {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load screenshot image.'));
    image.src = dataUrl;
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeRect(rect: ScreenshotRect, viewport = getViewportSize()): ScreenshotRect {
  const left = clamp(rect.left, 0, viewport.width - 1);
  const top = clamp(rect.top, 0, viewport.height - 1);
  const width = clamp(rect.width, 1, viewport.width - left);
  const height = clamp(rect.height, 1, viewport.height - top);

  return { left, top, width, height };
}

export async function cropScreenshotDataUrl(dataUrl: string, rect: ScreenshotRect): Promise<string> {
  const viewport = getViewportSize();
  const normalizedRect = normalizeRect(rect, viewport);
  const image = await loadImage(dataUrl);
  const scaleX = image.naturalWidth / viewport.width || 1;
  const scaleY = image.naturalHeight / viewport.height || 1;
  const targetWidth = Math.max(1, Math.round(normalizedRect.width * scaleX));
  const targetHeight = Math.max(1, Math.round(normalizedRect.height * scaleY));
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas is not available for screenshot cropping.');
  }

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  context.drawImage(
    image,
    Math.round(normalizedRect.left * scaleX),
    Math.round(normalizedRect.top * scaleY),
    targetWidth,
    targetHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );

  return canvas.toDataURL('image/png');
}

export async function stitchScreenshotDataUrls(dataUrls: string[]): Promise<string> {
  const images = await Promise.all(dataUrls.map(loadImage));
  const width = Math.max(1, ...images.map((image) => image.naturalWidth));
  const height = Math.max(1, images.reduce((sum, image) => sum + image.naturalHeight, 0));
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

export async function captureSelectedViewport(
  captureVisibleTab: () => Promise<string>,
  selection: ScreenshotRect,
): Promise<string> {
  const dataUrl = await captureVisibleTab();
  return cropScreenshotDataUrl(dataUrl, selection);
}

export function getScreenshotDocumentRange(selection: ScreenshotRect): ScreenshotDocumentRange {
  return {
    startY: window.scrollY + selection.top,
    endY: window.scrollY + selection.top + selection.height,
  };
}

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

export async function captureLongScreenshotSegments(
  captureVisibleTab: () => Promise<string>,
  selection: ScreenshotRect,
  segments: ScreenshotDocumentRange[],
): Promise<CapturedLongScreenshotChunk[]> {
  if (!segments.length) {
    return [];
  }

  const viewport = getViewportSize();
  const normalizedSelection = normalizeRect(selection, viewport);
  const viewportScrollY = window.scrollY;
  const dataUrl = await captureVisibleTab();

  return Promise.all(
    segments.map(async (segment) => {
      const startY = Math.min(segment.startY, segment.endY);
      const endY = Math.max(segment.startY, segment.endY);
      const chunkHeight = Math.max(1, endY - startY);
      const viewportTop = startY - viewportScrollY;

      return {
        startY,
        endY,
        dataUrl: await cropScreenshotDataUrl(dataUrl, {
          left: normalizedSelection.left,
          top: viewportTop,
          width: normalizedSelection.width,
          height: chunkHeight,
        }),
      };
    }),
  );
}

export async function stitchLongScreenshotChunks(chunks: CapturedLongScreenshotChunk[]): Promise<string> {
  return stitchScreenshotDataUrls(
    [...chunks].sort((left, right) => left.startY - right.startY).map((chunk) => chunk.dataUrl),
  );
}

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

export { waitForFrame as waitForScreenshotFrame };
