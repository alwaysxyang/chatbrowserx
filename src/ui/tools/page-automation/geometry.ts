export interface ViewportPoint {
  x: number;
  y: number;
}

export type CompactRect = [number, number, number, number];

/**
 * Returns the center point of a DOM rectangle in viewport coordinates.
 *
 * @param rect - The DOM rectangle.
 * @returns The center point.
 */
export function rectCenter(rect: DOMRect): ViewportPoint {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

/**
 * Rounds a DOM rectangle into a compact tuple.
 *
 * @param rect - The DOM rectangle.
 * @returns A compact `[x, y, width, height]` tuple.
 */
export function compactRect(rect: DOMRect): CompactRect {
  return [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)];
}

/**
 * Returns true if a rectangle overlaps the current viewport.
 *
 * @param rect - The DOM rectangle.
 * @param windowObject - The window that owns the document.
 * @returns True when any part of the rectangle is in the viewport.
 */
export function rectIntersectsViewport(rect: DOMRect, windowObject: Window): boolean {
  return rect.right > 0 && rect.bottom > 0 && rect.left < windowObject.innerWidth && rect.top < windowObject.innerHeight;
}

/**
 * Calculates how much two compact rectangles overlap relative to the smaller rectangle.
 *
 * @param first - First compact rectangle.
 * @param second - Second compact rectangle.
 * @returns Overlap ratio from 0 to 1.
 */
export function rectOverlapRatio(first: CompactRect, second: CompactRect): number {
  const left = Math.max(first[0], second[0]);
  const top = Math.max(first[1], second[1]);
  const right = Math.min(first[0] + first[2], second[0] + second[2]);
  const bottom = Math.min(first[1] + first[3], second[1] + second[3]);
  const width = Math.max(0, right - left);
  const height = Math.max(0, bottom - top);
  const overlapArea = width * height;
  const firstArea = first[2] * first[3];
  const secondArea = second[2] * second[3];
  const smallerArea = Math.min(firstArea, secondArea);

  return smallerArea > 0 ? overlapArea / smallerArea : 0;
}

/**
 * Scores how much of an element is visible in the viewport.
 *
 * @param element - The element to score.
 * @param windowObject - The window that owns the element.
 * @returns The visible area score.
 */
export function visibleAreaScore(element: Element, windowObject: Window): number {
  const rect = element.getBoundingClientRect();
  const width = Math.max(0, Math.min(rect.right, windowObject.innerWidth) - Math.max(rect.left, 0));
  const height = Math.max(0, Math.min(rect.bottom, windowObject.innerHeight) - Math.max(rect.top, 0));
  return width * height;
}
