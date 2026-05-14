import type { CandidateItem } from './interactable-candidate';
import { compactRect, rectIntersectsViewport } from './geometry';
import { truncateText } from './interactable-text';
import {
  isHiddenBySelfOrAncestor,
  isOwnedByChatBrowserX,
} from './dom-targets';

const maxTextChars = 240;
const textBlockSelector = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'p',
  'li',
  'dt',
  'dd',
  'td',
  'th',
  'caption',
  'blockquote',
  'pre',
  'figcaption',
  'article',
  'section',
  'main',
  'div',
].join(',');
const ignoredTextAncestorSelector = [
  'script',
  'style',
  'noscript',
  'template',
  'svg',
  'canvas',
  'input',
  'textarea',
  'select',
  'button',
  'a',
  'summary',
  'label',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable=true]',
].join(',');

interface TextBlockGroup {
  element: Element;
  role: 'heading' | 'text';
  parts: string[];
}

/**
 * Normalizes visible text into the single-line payload format used by page snapshots.
 *
 * @param value - Raw text content.
 * @returns A compact text string.
 */
function normalizeVisibleText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

/**
 * Creates a normalized string for duplicate comparisons.
 *
 * @param value - Raw text content.
 * @returns A lowercase compact comparison key.
 */
function normalizeTextKey(value: string): string {
  return normalizeVisibleText(value).toLowerCase();
}

/**
 * Splits normalized visible text into bounded snapshot fields without dropping content.
 *
 * @param value - Raw text content for one visible text block.
 * @returns Ordered text chunks that preserve the block text.
 */
function splitVisibleText(value: string): string[] {
  const normalized = normalizeVisibleText(value);
  const chunks: string[] = [];
  for (let offset = 0; offset < normalized.length; offset += maxTextChars) {
    const chunk = truncateText(normalized.slice(offset, offset + maxTextChars), maxTextChars);
    if (chunk) chunks.push(chunk);
  }
  return chunks;
}

/**
 * Checks whether a text node lives inside a non-text container already represented elsewhere.
 *
 * @param parentElement - The parent element of the text node.
 * @param representedItems - Items already exposed as structured page items.
 * @returns True when the text would duplicate an existing page item.
 */
function isInsideRepresentedElement(parentElement: Element, representedItems: CandidateItem[]): boolean {
  return representedItems.some((item) => item.role !== 'scrollarea' && item.element.contains(parentElement));
}

/**
 * Checks whether a text value duplicates an existing page item name.
 *
 * @param text - The candidate text.
 * @param representedNameKeys - Normalized names already exposed as structured page items.
 * @returns True when the text is already represented by a page item.
 */
function isRepresentedText(text: string, representedNameKeys: Set<string>): boolean {
  const textKey = normalizeTextKey(text);
  return textKey.length > 0 && representedNameKeys.has(textKey);
}

/**
 * Finds the nearest stable block element for a text node.
 *
 * @param element - The text node parent element.
 * @param documentObject - The document being scanned.
 * @returns The block element used for geometry and grouping.
 */
function findTextBlockElement(element: Element, documentObject: Document): Element | undefined {
  if (element.closest(ignoredTextAncestorSelector)) return undefined;

  for (let current: Element | null = element; current && current !== documentObject.body; current = current.parentElement) {
    if (current.matches(textBlockSelector)) {
      return current;
    }
  }

  return element;
}

/**
 * Infers a read-only text role from a text block element.
 *
 * @param element - The text block element.
 * @returns A compact read-only role.
 */
function inferTextRole(element: Element): 'heading' | 'text' {
  const tagName = element.tagName.toLowerCase();
  const explicitRole = element.getAttribute('role')?.trim().toLowerCase();
  return explicitRole === 'heading' || /^h[1-6]$/.test(tagName) ? 'heading' : 'text';
}

/**
 * Checks whether a text block is visible enough to expose in the current viewport.
 *
 * @param element - The text block element.
 * @param windowObject - The window that owns the document.
 * @returns True when the text block has usable visible geometry.
 */
function isVisibleTextBlock(element: Element, windowObject: Window): boolean {
  if (isOwnedByChatBrowserX(element) || isHiddenBySelfOrAncestor(element, windowObject)) return false;

  const rect = element.getBoundingClientRect();
  return rect.width >= 2 && rect.height >= 2 && rectIntersectsViewport(rect, windowObject);
}

/**
 * Adds a text node value to its nearest visible block group.
 *
 * @param groups - Mutable groups keyed by text block element.
 * @param textNode - The text node to collect.
 * @param documentObject - The document being scanned.
 * @param windowObject - The window that owns the document.
 * @param representedItems - Items already exposed as structured page items.
 * @param representedNameKeys - Normalized names already exposed as structured page items.
 */
function collectTextNode(
  groups: Map<Element, TextBlockGroup>,
  textNode: Text,
  documentObject: Document,
  windowObject: Window,
  representedItems: CandidateItem[],
  representedNameKeys: Set<string>,
): void {
  const text = normalizeVisibleText(textNode.textContent ?? '');
  const parentElement = textNode.parentElement;
  if (!text || !parentElement) return;
  if (isInsideRepresentedElement(parentElement, representedItems) || isRepresentedText(text, representedNameKeys)) return;

  const blockElement = findTextBlockElement(parentElement, documentObject);
  if (!blockElement || !isVisibleTextBlock(blockElement, windowObject)) return;

  const group = groups.get(blockElement) ?? {
    element: blockElement,
    role: inferTextRole(blockElement),
    parts: [],
  };
  group.parts.push(text);
  groups.set(blockElement, group);
}

/**
 * Converts collected text groups into read-only page snapshot items.
 *
 * @param groups - Text block groups collected from visible text nodes.
 * @returns Candidate items that expose text for page analysis.
 */
function serializeTextGroups(groups: Map<Element, TextBlockGroup>): CandidateItem[] {
  return Array.from(groups.values())
    .flatMap((group) => splitVisibleText(group.parts.join(' ')).map((text) => ({
      element: group.element,
      role: group.role,
      name: text,
      rect: compactRect(group.element.getBoundingClientRect()),
    })))
    .filter((item) => item.name.length > 0);
}

/**
 * Reads visible text blocks that were not represented by interactive candidates.
 *
 * @param documentObject - The document to scan.
 * @param windowObject - The window that owns the document.
 * @param representedItems - Items already exposed by the structured element scanner.
 * @returns Read-only text and heading items for the current viewport.
 */
export function readVisibleTextItems(
  documentObject: Document,
  windowObject: Window,
  representedItems: CandidateItem[],
): CandidateItem[] {
  if (!documentObject.body) return [];

  const representedNameKeys = new Set(representedItems.map((item) => normalizeTextKey(item.name)).filter(Boolean));
  const groups = new Map<Element, TextBlockGroup>();
  const walker = documentObject.createTreeWalker(
    documentObject.body,
    NodeFilter.SHOW_TEXT,
  );

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    collectTextNode(
      groups,
      node as Text,
      documentObject,
      windowObject,
      representedItems,
      representedNameKeys,
    );
  }

  return serializeTextGroups(groups);
}
