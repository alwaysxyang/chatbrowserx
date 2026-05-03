import { computeAccessibleName } from 'dom-accessibility-api';
import {
  findNestedWritableControl,
  isCodeEditorElement,
} from './dom-targets';
import { truncateText } from './interactable-text';

const maxNameChars = 120;
const maxHintChars = 80;

const semanticTokenAttributeNames = [
  'aria-label',
  'title',
  'alt',
  'data-icon',
  'data-testid',
  'data-test-id',
  'data-cy',
  'data-tooltip',
  'data-tooltip-content',
  'id',
  'class',
];

const directSemanticTokenAttributeNames = semanticTokenAttributeNames.filter((attributeName) => ![
  'data-tooltip',
  'data-tooltip-content',
  'id',
  'class',
].includes(attributeName));

const semanticTokenPatterns: Array<[RegExp, string]> = [
  [/\b(thumbs?[-_\s]?down|vote[-_\s]?down|downvote|dislike)\b/, 'dislike'],
  [/\b(thumbs?[-_\s]?up|vote[-_\s]?up|upvote|like)\b/, 'like'],
  [/\b(bookmark|save[-_\s]?for[-_\s]?later)\b/, 'bookmark'],
  [/\b(favorite|favourite|star)\b/, 'favorite'],
  [/\b(comment|comments|chat|message|discussion)\b/, 'comments'],
  [/\b(share|send)\b/, 'share'],
  [/\b(external[-_\s]?link|open[-_\s]?in[-_\s]?new|open[-_\s]?new|launch)\b/, 'open'],
  [/\b(help|question[-_\s]?circle|circle[-_\s]?help)\b/, 'help'],
  [/\b(copy|clipboard)\b/, 'copy'],
  [/\b(search|magnify|magnifier)\b/, 'search'],
  [/\b(close|dismiss|xmark|times)\b/, 'close'],
  [/\b(menu|hamburger|more[-_\s]?horizontal|more[-_\s]?vertical|ellipsis)\b/, 'menu'],
  [/\b(prev|previous|chevron[-_\s]?left|arrow[-_\s]?left)\b/, 'previous'],
  [/\b(next|chevron[-_\s]?right|arrow[-_\s]?right)\b/, 'next'],
  [/\b(play)\b/, 'play'],
  [/\b(pause)\b/, 'pause'],
  [/\b(download)\b/, 'download'],
  [/\b(upload)\b/, 'upload'],
  [/\b(edit|pencil)\b/, 'edit'],
  [/\b(delete|trash|remove)\b/, 'delete'],
  [/\b(filter|funnel)\b/, 'filter'],
  [/\b(settings|setting|gear|cog)\b/, 'settings'],
  [/\b(expand|maximize)\b/, 'expand'],
  [/\b(collapse|minimize)\b/, 'collapse'],
];

/**
 * Normalizes attribute-like values into words that semantic token patterns can match.
 *
 * @param value - Raw attribute or SVG title text.
 * @returns Lowercase text with separators normalized.
 */
function normalizeSemanticToken(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[#./:[\](){}]+/g, ' ')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/**
 * Maps a bounded token string to a model-friendly control semantic when recognized.
 *
 * @param value - Attribute or title text to inspect.
 * @returns A semantic action label when the token is recognized.
 */
function inferSemanticLabelFromToken(value: string): string | undefined {
  const normalized = normalizeSemanticToken(value);
  if (!normalized) return undefined;

  return semanticTokenPatterns.find(([pattern]) => pattern.test(normalized))?.[1];
}

/**
 * Reads known semantic tokens from an element and a small descendant set.
 *
 * @param element - The candidate element.
 * @param options - Whether to inspect descendants or only direct control tokens.
 * @returns A model-friendly action label when available.
 */
export function readSemanticLabelFromElement(
  element: Element,
  options: { includeDescendants?: boolean; directOnly?: boolean } = {},
): string | undefined {
  const inspectTargets = options.includeDescendants
    ? [element, ...Array.from(element.querySelectorAll('*')).slice(0, 24)]
    : [element];
  const attributeNames = options.directOnly ? directSemanticTokenAttributeNames : semanticTokenAttributeNames;

  for (const target of inspectTargets) {
    const svgTitle = target.tagName.toLowerCase() === 'title' ? truncateText(target.textContent ?? '', maxNameChars) : '';
    const titleLabel = svgTitle ? inferSemanticLabelFromToken(svgTitle) : undefined;
    if (titleLabel) return titleLabel;

    for (const attributeName of attributeNames) {
      const label = inferSemanticLabelFromToken(target.getAttribute(attributeName) ?? '');
      if (label) return label;
    }

    const href = target.getAttribute('href') ?? target.getAttribute('xlink:href') ?? '';
    const hrefLabel = inferSemanticLabelFromToken(href);
    if (hrefLabel) return hrefLabel;
  }

  return undefined;
}

/**
 * Checks whether an element directly exposes a known control semantic token.
 *
 * @param element - The candidate element.
 * @returns True when a direct attribute can identify a compact semantic control.
 */
export function hasDirectSemanticControlToken(element: Element): boolean {
  return readSemanticLabelFromElement(element, { directOnly: true }) !== undefined;
}

/**
 * Checks whether text is compact enough to serve as nearby context for an unlabeled control.
 *
 * @param value - Candidate nearby text.
 * @returns True when the text is short and likely describes adjacent UI context.
 */
function isCompactNearbyContext(value: string): boolean {
  if (!value || value.length > 32) return false;
  return /^[\p{L}\p{N}\s.,:+#%()/&-]+$/u.test(value);
}

/**
 * Reads nearby compact sibling text for unlabeled controls without scanning broad DOM content.
 *
 * @param element - The candidate element.
 * @returns A bounded nearby label or count when present.
 */
function readNearbyCompactContext(element: Element): string | undefined {
  const siblings = [
    element.previousElementSibling,
    element.nextElementSibling,
  ];

  for (const sibling of siblings) {
    const text = truncateText(sibling?.textContent ?? '', 32);
    if (isCompactNearbyContext(text)) return text;
  }

  return undefined;
}

/**
 * Builds a conservative fallback label for interactables with no page-provided name.
 *
 * @param role - The inferred interactable role.
 * @param element - The candidate element.
 * @returns A generic label with nearby context when available.
 */
function buildUnlabeledControlName(role: string, element: Element): string {
  const context = readNearbyCompactContext(element);
  const genericName = `unlabeled ${role}`;
  return context ? `${genericName} near ${context}` : genericName;
}

/**
 * Checks whether a name was synthesized only to keep an unnamed control visible.
 *
 * @param name - Candidate name.
 * @returns True when the name is an unlabeled-control fallback.
 */
export function isUnlabeledFallbackName(name: string): boolean {
  return name.startsWith('unlabeled ');
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
 * Reads the best name available from a writable control nested inside a wrapper.
 *
 * @param element - The wrapper candidate.
 * @param windowObject - The window that owns the element.
 * @returns A nested writable control name when the wrapper should defer to it.
 */
function readNestedWritableControlName(element: Element, windowObject: Window): string | undefined {
  const nestedWritable = findNestedWritableControl(element, windowObject);
  if (isCodeEditorElement(element) || !nestedWritable || nestedWritable === element) return undefined;

  const nestedAccessibleName = truncateText(computeAccessibleName(nestedWritable), maxNameChars);
  const nestedAriaLabel = truncateText(nestedWritable.getAttribute('aria-label') ?? '', maxNameChars);
  const nestedTitle = truncateText(nestedWritable.getAttribute('title') ?? '', maxNameChars);
  const nestedPlaceholder = nestedWritable instanceof HTMLInputElement || nestedWritable instanceof HTMLTextAreaElement
    ? truncateText(nestedWritable.placeholder, maxNameChars)
    : '';

  return nestedAccessibleName || nestedAriaLabel || nestedTitle || nestedPlaceholder || undefined;
}

/**
 * Reads a model-friendly control name with a visible-text fallback for generic clickable elements.
 *
 * @param element - The candidate element.
 * @param role - The inferred candidate role.
 * @param windowObject - The window that owns the element.
 * @returns A bounded control name.
 */
export function readControlName(element: Element, role: string, windowObject: Window): string {
  const nestedWritableName = readNestedWritableControlName(element, windowObject);
  if (nestedWritableName) return nestedWritableName;

  const accessibleName = truncateText(computeAccessibleName(element), maxNameChars);
  const ariaLabel = truncateText(element.getAttribute('aria-label') ?? '', maxNameChars);
  const title = truncateText(element.getAttribute('title') ?? '', maxNameChars);
  const visibleText = truncateText(element.textContent ?? '', maxNameChars);
  const semanticName = readSemanticLabelFromElement(element, { includeDescendants: true });

  if (accessibleName && accessibleName !== title) {
    if (visibleText && semanticName && accessibleName === visibleText) {
      return truncateText(`${semanticName} ${visibleText}`, maxNameChars);
    }
    return accessibleName;
  }
  if (ariaLabel) return ariaLabel;
  if (role === 'scrollarea') return title || 'scrollable area';
  if (visibleText && semanticName) return truncateText(`${semanticName} ${visibleText}`, maxNameChars);
  if (visibleText) return visibleText;
  if (semanticName) return semanticName;
  if (role) return buildUnlabeledControlName(role, element);
  return accessibleName || title;
}
