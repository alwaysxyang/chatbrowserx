import {
  isCodeEditorElement,
  isWritableTextElement,
} from './dom-targets';
import { isNestedWritableTextboxWrapper } from './interactable-textbox-wrapper';

/**
 * Returns true when a text candidate is a focused form field surface instead of a broad form container.
 *
 * @param element - The candidate element.
 * @param role - The inferred role.
 * @param rect - Candidate geometry.
 * @param windowObject - The window that owns the document.
 * @returns True when covered hit-testing can be relaxed for this element.
 */
function isFocusedTextboxSurface(element: Element, role: string, rect: DOMRect, windowObject: Window): boolean {
  if (role !== 'textbox' && role !== 'searchbox') return false;
  const isTextboxWrapper = isNestedWritableTextboxWrapper(element, rect, windowObject);
  if (!isWritableTextElement(element) && !isTextboxWrapper && !isCodeEditorElement(element)) {
    return false;
  }
  if (isCodeEditorElement(element)) return true;

  return isTextboxWrapper;
}

/**
 * Checks whether the element appears to be the topmost target at its center point.
 *
 * @param element - The candidate element.
 * @param rect - The candidate rectangle.
 * @param documentObject - The document that owns the element.
 * @param windowObject - The window that owns the document.
 * @returns True when the element is not obviously covered by another element.
 */
function isTopmostAtCenter(element: Element, rect: DOMRect, documentObject: Document, windowObject: Window): boolean {
  const x = Math.min(Math.max(rect.left + rect.width / 2, 0), Math.max(windowObject.innerWidth - 1, 0));
  const y = Math.min(Math.max(rect.top + rect.height / 2, 0), Math.max(windowObject.innerHeight - 1, 0));
  const topElement = documentObject.elementFromPoint(x, y);

  const isSpecificAncestor = topElement !== documentObject.body &&
    topElement !== documentObject.documentElement &&
    topElement?.contains(element);

  return topElement == null || topElement === element || element.contains(topElement) || isSpecificAncestor === true;
}

/**
 * Checks whether a candidate should pass visibility hit-testing.
 *
 * @param element - The candidate element.
 * @param role - Inferred role.
 * @param rect - Candidate geometry.
 * @param documentObject - The document that owns the element.
 * @param windowObject - The window that owns the document.
 * @returns True when the candidate is visible enough for interaction.
 */
export function passesHitTest(
  element: Element,
  role: string,
  rect: DOMRect,
  documentObject: Document,
  windowObject: Window,
): boolean {
  return isTopmostAtCenter(element, rect, documentObject, windowObject) ||
    isFocusedTextboxSurface(element, role, rect, windowObject);
}
