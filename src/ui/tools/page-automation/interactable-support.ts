import { computeAccessibleName } from 'dom-accessibility-api';
import type { GetPageInteractablesToolPayload } from '../../../shared/types/tools';
import {
  findNestedWritableControl,
  isCodeEditorElement,
  isWritableTextElement,
} from './dom-targets';

export const maxItems = 60;
const maxNameChars = 120;
const maxHintChars = 80;
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

export interface InteractablesDiagnostics {
  q: NonNullable<GetPageInteractablesToolPayload['d']>['q'];
  samples: NonNullable<GetPageInteractablesToolPayload['d']>['samples'];
}

type SnapshotMeta = NonNullable<GetPageInteractablesToolPayload['items'][number][4]>;

/**
 * Truncates text to a token-bounded single-line value.
 *
 * @param value - The raw text.
 * @param maxChars - Maximum characters to keep.
 * @returns A normalized, truncated string.
 */
function truncateText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxChars) return normalized;
  return normalized.slice(0, maxChars).trim();
}

/**
 * Creates empty counters for abnormal snapshot diagnostics.
 *
 * @returns Mutable diagnostics counters.
 */
export function createDiagnostics(): InteractablesDiagnostics {
  return {
    q: {
      total: 0,
      owned: 0,
      hidden: 0,
      disabled: 0,
      noRole: 0,
      small: 0,
      covered: 0,
      kept: 0,
      writable: 0,
      wrappers: 0,
      p: 0,
    },
    samples: [],
  };
}

/**
 * Adds a bounded diagnostic sample for elements likely related to missed controls.
 *
 * @param diagnostics - Mutable diagnostics state.
 * @param element - The sampled element.
 * @param reason - The scan stage or filter reason.
 * @param role - Optional inferred role.
 * @param rect - Optional compact rectangle.
 */
export function addDiagnosticsSample(
  diagnostics: InteractablesDiagnostics,
  element: Element,
  reason: string,
  role?: string,
  rect?: [number, number, number, number],
): void {
  if (diagnostics.samples && diagnostics.samples.length >= 10) return;

  const tag = element.tagName.toLowerCase();
  const id = element.id;
  const className = typeof element.className === 'string' ? element.className : '';
  const text = truncateText(element.textContent ?? '', 80);
  const isLikelyRelevant = (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    tag === 'p' ||
    className.includes('pass-form-item') ||
    id.includes('TANGRAM') ||
    role === 'textbox'
  );

  if (!isLikelyRelevant) return;
  diagnostics.samples?.push({
    tag,
    id: id || undefined,
    cls: className ? truncateText(className, 80) : undefined,
    role,
    reason,
    text: text || undefined,
    rect,
  });
}

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
  if (hasGenericClickAffordance(element, windowObject)) return 'button';
  return null;
}

/**
 * Reads a short secondary hint for input-like controls.
 *
 * @param element - The candidate element.
 * @returns A bounded hint string when available.
 */
export function readValueHint(element: Element): string | undefined {
  const nestedWritable = findNestedWritableControl(element, element.ownerDocument.defaultView ?? window);
  if (nestedWritable && nestedWritable !== element) {
    return readValueHint(nestedWritable);
  }

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    return truncateText(element.placeholder || element.value, maxHintChars) || undefined;
  }

  if (element instanceof HTMLSelectElement) {
    return truncateText(element.selectedOptions[0]?.textContent ?? '', maxHintChars) || undefined;
  }

  return truncateText(element.getAttribute('title') ?? '', maxHintChars) || undefined;
}

/**
 * Reads a model-friendly control name with a visible-text fallback for generic clickable elements.
 *
 * @param element - The candidate element.
 * @returns A bounded control name.
 */
export function readControlName(element: Element, role: string, windowObject: Window): string {
  const nestedWritable = findNestedWritableControl(element, windowObject);
  if (!isCodeEditorElement(element) && nestedWritable && nestedWritable !== element) {
    const nestedAccessibleName = truncateText(computeAccessibleName(nestedWritable), maxNameChars);
    const nestedAriaLabel = truncateText(nestedWritable.getAttribute('aria-label') ?? '', maxNameChars);
    const nestedTitle = truncateText(nestedWritable.getAttribute('title') ?? '', maxNameChars);
    const nestedPlaceholder = nestedWritable instanceof HTMLInputElement || nestedWritable instanceof HTMLTextAreaElement
      ? truncateText(nestedWritable.placeholder, maxNameChars)
      : '';

    return nestedAccessibleName || nestedAriaLabel || nestedTitle || nestedPlaceholder;
  }

  const accessibleName = truncateText(computeAccessibleName(element), maxNameChars);
  const ariaLabel = truncateText(element.getAttribute('aria-label') ?? '', maxNameChars);
  const title = truncateText(element.getAttribute('title') ?? '', maxNameChars);
  const visibleText = truncateText(element.textContent ?? '', maxNameChars);

  if (accessibleName && accessibleName !== title) return accessibleName;
  if (ariaLabel) return ariaLabel;
  if (role === 'scrollarea') return title || 'scrollable area';
  if (visibleText) return visibleText;
  return accessibleName || title;
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
 * Checks whether a parent candidate already represents the child candidate.
 *
 * @param parent - The ancestor candidate.
 * @param child - The descendant candidate.
 * @returns True when the child would be duplicate noise in the snapshot.
 */
function isNestedDuplicateCandidate(parent: CandidateItem, child: CandidateItem): boolean {
  if (parent.element.contains(child.element) && parent.role === 'button' && (child.role === 'checkbox' || child.role === 'radio')) {
    return true;
  }
  if (parent.role !== child.role || !parent.element.contains(child.element)) return false;
  if (!child.name) return true;
  return parent.name === child.name || parent.name.includes(child.name);
}

/**
 * Removes nested generic candidates that describe the same clickable surface.
 *
 * @param items - Candidate items in DOM order.
 * @returns Deduplicated candidate items.
 */
export function deduplicateNestedCandidates(items: CandidateItem[]): CandidateItem[] {
  return items.filter((item, index) => !items.some((candidate, candidateIndex) => (
    candidateIndex !== index &&
    candidateIndex < index &&
    isNestedDuplicateCandidate(candidate, item)
  )));
}
