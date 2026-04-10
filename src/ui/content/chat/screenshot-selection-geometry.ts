import type { CSSProperties } from 'react';
import type { ScreenshotRect } from './screenshot-capture';

export type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

const minSelectionSize = 24;
const resizeThreshold = 8;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getViewportSize() {
  return {
    width: Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1),
    height: Math.max(1, window.innerHeight || document.documentElement.clientHeight || 1),
  };
}

export function toSelection(startX: number, startY: number, endX: number, endY: number): ScreenshotRect {
  const left = Math.min(startX, endX);
  const top = Math.min(startY, endY);
  const width = Math.max(minSelectionSize, Math.abs(endX - startX));
  const height = Math.max(minSelectionSize, Math.abs(endY - startY));

  return { left, top, width, height };
}

export function isInsideSelection(x: number, y: number, selection: ScreenshotRect): boolean {
  return (
    x >= selection.left &&
    x <= selection.left + selection.width &&
    y >= selection.top &&
    y <= selection.top + selection.height
  );
}

export function getResizeEdge(x: number, y: number, selection: ScreenshotRect): ResizeEdge | null {
  if (!isInsideSelection(x, y, selection)) {
    return null;
  }

  const isNearLeft = Math.abs(x - selection.left) <= resizeThreshold;
  const isNearRight = Math.abs(x - (selection.left + selection.width)) <= resizeThreshold;
  const isNearTop = Math.abs(y - selection.top) <= resizeThreshold;
  const isNearBottom = Math.abs(y - (selection.top + selection.height)) <= resizeThreshold;
  const horizontal = isNearLeft ? 'w' : isNearRight ? 'e' : '';
  const vertical = isNearTop ? 'n' : isNearBottom ? 's' : '';

  return (vertical || horizontal ? `${vertical}${horizontal}` : null) as ResizeEdge | null;
}

export function cursorForEdge(edge: ResizeEdge | null): CSSProperties['cursor'] | null {
  if (!edge) {
    return null;
  }

  if (edge === 'n' || edge === 's') return 'ns-resize';
  if (edge === 'e' || edge === 'w') return 'ew-resize';
  if (edge === 'ne' || edge === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

export function moveSelection(selection: ScreenshotRect, dx: number, dy: number): ScreenshotRect {
  const viewport = getViewportSize();
  const width = Math.min(selection.width, viewport.width);
  const height = Math.min(selection.height, viewport.height);

  return {
    left: clamp(selection.left + dx, 0, Math.max(0, viewport.width - width)),
    top: clamp(selection.top + dy, 0, Math.max(0, viewport.height - height)),
    width,
    height,
  };
}

export function resizeSelection(
  selection: ScreenshotRect,
  edge: ResizeEdge,
  dx: number,
  dy: number,
): ScreenshotRect {
  const viewport = getViewportSize();
  let { left, top, width, height } = selection;

  if (edge.includes('e')) {
    width += dx;
  }

  if (edge.includes('s')) {
    height += dy;
  }

  if (edge.includes('w')) {
    left += dx;
    width -= dx;
  }

  if (edge.includes('n')) {
    top += dy;
    height -= dy;
  }

  if (width < minSelectionSize) {
    if (edge.includes('w')) {
      left = selection.left + selection.width - minSelectionSize;
    }
    width = minSelectionSize;
  }

  if (height < minSelectionSize) {
    if (edge.includes('n')) {
      top = selection.top + selection.height - minSelectionSize;
    }
    height = minSelectionSize;
  }

  if (left < 0) {
    width += left;
    left = 0;
  }

  if (top < 0) {
    height += top;
    top = 0;
  }

  width = clamp(width, minSelectionSize, Math.max(minSelectionSize, viewport.width - left));
  height = clamp(height, minSelectionSize, Math.max(minSelectionSize, viewport.height - top));

  return { left, top, width, height };
}
