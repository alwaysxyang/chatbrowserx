import { findNestedWritableControl } from './dom-targets';

/**
 * Checks whether a candidate rectangle is small enough to represent one proxied text field.
 *
 * @param element - The candidate wrapper element.
 * @param rect - The wrapper viewport rectangle.
 * @param windowObject - The window that owns the candidate.
 * @returns True when the wrapper is a known form row or compact text-entry surface.
 */
export function isCompactTextboxWrapperSurface(element: Element, rect: DOMRect, windowObject: Window): boolean {
  const tagName = element.tagName.toLowerCase();
  const className = typeof element.className === 'string' ? element.className : '';
  const isKnownFormRow = tagName === 'p' || tagName === 'label' || className.includes('pass-form-item');
  const isCompactSurface = rect.height <= 160 && rect.width <= Math.min(windowObject.innerWidth * 0.85, 1000);

  return isKnownFormRow || isCompactSurface;
}

/**
 * Checks whether a candidate is a compact wrapper around a nested writable control.
 *
 * @param element - The candidate wrapper element.
 * @param rect - The wrapper viewport rectangle.
 * @param windowObject - The window that owns the candidate.
 * @returns True when the candidate should be treated as a textbox wrapper.
 */
export function isNestedWritableTextboxWrapper(element: Element, rect: DOMRect, windowObject: Window): boolean {
  const nestedWritable = findNestedWritableControl(element, windowObject);
  return nestedWritable !== undefined &&
    nestedWritable !== element &&
    isCompactTextboxWrapperSurface(element, rect, windowObject);
}
