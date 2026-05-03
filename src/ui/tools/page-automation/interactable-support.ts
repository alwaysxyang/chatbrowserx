import type { GetPageInteractablesToolPayload } from '../../../shared/types/tools';
import {
  findNestedWritableControl,
  isCodeEditorElement,
  isWritableTextElement,
} from './dom-targets';
import {
  hasDirectSemanticControlToken,
  isUnlabeledFallbackName,
  readSemanticLabelFromElement,
} from './interactable-naming';

export const maxItems = 60;
export const diagnosticsVersion = 'aria-20260428.2';

export const candidateSelector = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'textarea',
  'select',
  'summary',
  'label',
  'main',
  'section',
  'article',
  'aside',
  'p',
  'div',
  'span',
  'li',
  'td',
  'th',
  '[role]',
  '[tabindex]',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[aria-label]',
  '[title]',
  '[data-icon]',
  '[data-testid]',
  '[data-test-id]',
  '[data-cy]',
  '[onclick]',
  '[aria-controls]',
  '[aria-haspopup]',
  '[aria-expanded]',
  '[style*="cursor:pointer" i]',
  '[style*="cursor: pointer" i]',
].join(',');

const interactiveRoles = new Set([
  'button',
  'link',
  'textbox',
  'searchbox',
  'checkbox',
  'radio',
  'combobox',
  'menuitem',
  'tab',
  'switch',
  'slider',
  'option',
]);

export interface CandidateItem {
  element: Element;
  role: string;
  name: string;
  hint?: string;
  inputType?: string;
  checked?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  scrollAxis?: 'x' | 'y' | 'xy';
  rect: [number, number, number, number];
}

type SnapshotMeta = NonNullable<GetPageInteractablesToolPayload['items'][number][4]>;

/**
 * Finds a nested checkbox or radio control inside a composite clickable row.
 *
 * @param element - The element to inspect.
 * @returns The nested checkable input when present.
 */
export function findNestedCheckableInput(element: Element): HTMLInputElement | undefined {
  const input = element.querySelector('input[type="checkbox"], input[type="radio"]');
  return input instanceof HTMLInputElement ? input : undefined;
}

/**
 * Reads the scroll axis for an element when it is visibly scrollable.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the document.
 * @returns The scroll axis when the element can scroll.
 */
export function readScrollAxis(element: Element, windowObject: Window): 'x' | 'y' | 'xy' | undefined {
  const htmlElement = element as HTMLElement;
  const style = windowObject.getComputedStyle(htmlElement);
  const overflowY = ['auto', 'scroll', 'overlay'].includes(style.overflowY);
  const overflowX = ['auto', 'scroll', 'overlay'].includes(style.overflowX);
  const scrollsY = overflowY && htmlElement.scrollHeight > htmlElement.clientHeight;
  const scrollsX = overflowX && htmlElement.scrollWidth > htmlElement.clientWidth;

  if (scrollsX && scrollsY) return 'xy';
  if (scrollsX) return 'x';
  if (scrollsY) return 'y';
  return undefined;
}

/**
 * Checks whether a non-native element exposes common clickable affordances.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the document.
 * @returns True when the element should be treated as a generic button.
 */
function hasGenericClickAffordance(element: Element, windowObject: Window): boolean {
  const htmlElement = element as HTMLElement;
  const tabIndex = element.getAttribute('tabindex');
  const cursor = windowObject.getComputedStyle(htmlElement).cursor;

  return (
    typeof htmlElement.onclick === 'function' ||
    element.hasAttribute('onclick') ||
    element.hasAttribute('aria-controls') ||
    element.hasAttribute('aria-haspopup') ||
    element.hasAttribute('aria-expanded') ||
    (tabIndex !== null && Number(tabIndex) >= 0) ||
    cursor === 'pointer'
  );
}

/**
 * Infers the interactable role from native semantics and explicit ARIA roles.
 *
 * @param element - The candidate element.
 * @param windowObject - The window that owns the document.
 * @returns A compact role name for model consumption, or null when unsupported.
 */
export function inferRole(element: Element, windowObject: Window): string | null {
  if (isCodeEditorElement(element)) return 'textbox';

  const explicitRole = element.getAttribute('role')?.trim().split(/\s+/)[0]?.toLowerCase();
  if (explicitRole) {
    if (interactiveRoles.has(explicitRole)) return explicitRole;
  }

  const tagName = element.tagName.toLowerCase();
  if (tagName === 'button' || tagName === 'summary') return 'button';
  if (tagName === 'a' && element.hasAttribute('href')) return 'link';
  if (tagName === 'textarea') return 'textbox';
  if (tagName === 'select') return 'combobox';

  if (tagName === 'input') {
    const type = ((element as HTMLInputElement).type || 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'range') return 'slider';
    if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
    return 'textbox';
  }

  if ((element as HTMLElement).isContentEditable) return 'textbox';
  if (findNestedWritableControl(element, windowObject)) return 'textbox';
  if (readScrollAxis(element, windowObject)) return 'scrollarea';
  if (explicitRole) return null;
  if (hasDirectSemanticControlToken(element)) return 'button';
  if (hasGenericClickAffordance(element, windowObject)) return 'button';
  return null;
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
  const nestedWritable = findNestedWritableControl(element, windowObject);
  if (!isWritableTextElement(element) && !nestedWritable && !isCodeEditorElement(element)) {
    return false;
  }
  if (isCodeEditorElement(element)) return true;

  const tagName = element.tagName.toLowerCase();
  const className = typeof element.className === 'string' ? element.className : '';
  const isKnownFormRow = tagName === 'p' || tagName === 'label' || className.includes('pass-form-item');
  const isCompactSurface = rect.height <= 160 && rect.width <= Math.min(windowObject.innerWidth * 0.85, 1000);

  return nestedWritable !== undefined && nestedWritable !== element && (isKnownFormRow || isCompactSurface);
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

/**
 * Rounds a DOM rectangle into a compact tuple.
 *
 * @param rect - The DOM rectangle.
 * @returns A compact `[x, y, width, height]` tuple.
 */
export function compactRect(rect: DOMRect): [number, number, number, number] {
  return [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)];
}

/**
 * Builds an optional compact metadata object for a candidate.
 *
 * @param element - The candidate element.
 * @param hint - The optional value hint.
 * @returns Compact metadata or undefined when no metadata is useful.
 */
export function buildMeta(item: CandidateItem): SnapshotMeta | undefined {
  const meta: SnapshotMeta = {};

  if (item.hint) meta.h = item.hint;
  if (item.inputType) meta.t = item.inputType;
  if (item.checked !== undefined) meta.checked = item.checked;
  if (item.expanded !== undefined) meta.expanded = item.expanded;
  if (item.pressed !== undefined) meta.pressed = item.pressed;
  if (item.scrollAxis !== undefined) meta.s = item.scrollAxis;

  return Object.keys(meta).length > 0 ? meta : undefined;
}

/**
 * Checks whether a nested semantic icon is only the visual glyph of a named parent control.
 *
 * @param parent - The ancestor candidate.
 * @param child - The descendant candidate.
 * @returns True when the child should be removed as duplicate icon noise.
 */
function isNestedDecorativeIconCandidate(parent: CandidateItem, child: CandidateItem): boolean {
  if (!['button', 'link'].includes(parent.role)) return false;
  if (child.role !== 'button' || !parent.name || isUnlabeledFallbackName(parent.name)) return false;
  if (!readSemanticLabelFromElement(child.element, { includeDescendants: true })) return false;

  const parentArea = parent.rect[2] * parent.rect[3];
  const childArea = child.rect[2] * child.rect[3];
  const isCompactChild = child.rect[2] <= 48 && child.rect[3] <= 48;

  return parentArea > 0 && childArea > 0 && isCompactChild && childArea <= parentArea * 0.7;
}

/**
 * Calculates how much two compact rectangles overlap relative to the smaller rectangle.
 *
 * @param first - First compact rectangle.
 * @param second - Second compact rectangle.
 * @returns Overlap ratio from 0 to 1.
 */
function rectOverlapRatio(first: CandidateItem['rect'], second: CandidateItem['rect']): number {
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
 * Checks whether an accessibility textbox duplicates a richer code editor surface.
 *
 * @param codeEditor - Candidate representing the code editor surface.
 * @param duplicate - Candidate that may duplicate the editor.
 * @returns True when the duplicate should be removed.
 */
function isOverlappingCodeEditorTextboxDuplicate(codeEditor: CandidateItem, duplicate: CandidateItem): boolean {
  if (codeEditor.inputType !== 'code') return false;
  if (duplicate.inputType === 'code' || duplicate.role !== 'textbox') return false;

  const duplicateName = duplicate.name.toLowerCase();
  const looksLikeEditorAccessibilityNode = duplicateName.includes('editor content') ||
    duplicateName.includes('accessibility options');

  return looksLikeEditorAccessibilityNode && rectOverlapRatio(codeEditor.rect, duplicate.rect) >= 0.9;
}

/**
 * Checks whether a parent candidate already represents the child candidate.
 *
 * @param parent - The ancestor candidate.
 * @param child - The descendant candidate.
 * @returns True when the child would be duplicate noise in the snapshot.
 */
function isNestedDuplicateCandidate(parent: CandidateItem, child: CandidateItem): boolean {
  if (!parent.element.contains(child.element)) return false;
  if (isUnlabeledFallbackName(child.name)) return true;
  if (isNestedDecorativeIconCandidate(parent, child)) return true;
  if (parent.element.contains(child.element) && parent.role === 'button' && (child.role === 'checkbox' || child.role === 'radio')) {
    return true;
  }
  if (parent.role !== child.role) return false;
  if (!child.name) return true;
  return parent.name === child.name || parent.name.includes(child.name);
}

/**
 * Removes descendants already represented by an earlier candidate.
 *
 * @param items - Candidate items in DOM order.
 * @returns Candidate items without nested duplicates.
 */
function removeNestedDuplicateCandidates(items: CandidateItem[]): CandidateItem[] {
  const deduplicatedItems: CandidateItem[] = [];

  for (const item of items) {
    if (!deduplicatedItems.some((candidate) => isNestedDuplicateCandidate(candidate, item))) {
      deduplicatedItems.push(item);
    }
  }

  return deduplicatedItems;
}

/**
 * Removes accessibility textboxes that duplicate an overlapping code editor surface.
 *
 * @param items - Candidate items after nested duplicate removal.
 * @returns Candidate items without code editor accessibility duplicates.
 */
function removeOverlappingCodeEditorTextboxDuplicates(items: CandidateItem[]): CandidateItem[] {
  const codeEditorItems = items.filter((item) => item.inputType === 'code');

  if (codeEditorItems.length === 0) {
    return items;
  }

  return items.filter((item) => !codeEditorItems.some((codeEditor) => (
    codeEditor !== item &&
    isOverlappingCodeEditorTextboxDuplicate(codeEditor, item)
  )));
}

/**
 * Removes duplicate candidates that describe the same interactive surface.
 *
 * @param items - Candidate items in DOM order.
 * @returns Deduplicated candidate items.
 */
export function deduplicateNestedCandidates(items: CandidateItem[]): CandidateItem[] {
  return removeOverlappingCodeEditorTextboxDuplicates(removeNestedDuplicateCandidates(items));
}
