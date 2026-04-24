import { computeAccessibleName } from 'dom-accessibility-api';
import {
  isGetPageInteractablesToolRequestMessage,
  type GetPageInteractablesToolPayload,
} from '../../shared/types/tool';

const maxItems = 60;
const maxNameChars = 120;
const maxHintChars = 80;
const diagnosticsVersion = 'aria-20260428.2';
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
const candidateSelector = [
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

interface CandidateItem {
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

interface InteractablesDiagnostics {
  q: NonNullable<GetPageInteractablesToolPayload['d']>['q'];
  samples: NonNullable<GetPageInteractablesToolPayload['d']>['samples'];
}

const codeEditorSelector = [
  '.monaco-editor',
  '.cm-editor',
  '.CodeMirror',
  '.ace_editor',
  '[data-mode-id]',
].join(',');
const ownedRootSelector = '#chatbrowserx-root,#chatbrowserx-page-action-overlay,#chatbrowserx-subtitle-container';

type SnapshotMeta = NonNullable<GetPageInteractablesToolPayload['items'][number][4]>;

let latestSnapshotRefs = new Map<string, Element>();
let latestSnapshotSid: string | undefined;
let snapshotSequence = 0;

/**
 * Creates a short content-script-local snapshot ID.
 *
 * @returns A compact snapshot ID for matching refs to the latest scan.
 */
function createSnapshotSid(): string {
  snapshotSequence += 1;
  return `s_${snapshotSequence.toString(36)}`;
}

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
function createDiagnostics(): InteractablesDiagnostics {
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
function addDiagnosticsSample(
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
 * Checks whether an element or ancestor is hidden from users or the accessibility tree.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the document.
 * @returns True if the element should be skipped.
 */
function isHiddenBySelfOrAncestor(element: Element, windowObject: Window): boolean {
  for (let current: Element | null = element; current; current = current.parentElement) {
    const htmlElement = current as HTMLElement;
    const style = windowObject.getComputedStyle(htmlElement);

    if (
      htmlElement.hidden ||
      htmlElement.inert ||
      current.getAttribute('aria-hidden') === 'true' ||
      style.display === 'none' ||
      style.visibility === 'hidden' ||
      style.visibility === 'collapse' ||
      style.opacity === '0'
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Returns true if the element is disabled for user interaction.
 *
 * @param element - The element to inspect.
 * @returns True when the element is disabled.
 */
function isDisabledElement(element: Element): boolean {
  if (element.getAttribute('aria-disabled') === 'true') return true;
  if ('disabled' in element && Boolean((element as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled)) {
    return true;
  }
  return element.closest('fieldset[disabled]') !== null;
}

/**
 * Checks whether an element belongs to ChatBrowserX injected UI.
 *
 * @param element - The element to inspect.
 * @returns True when the element should not be exposed as page content.
 */
function isOwnedByChatBrowserX(element: Element): boolean {
  const root = element.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot && root.host instanceof Element) {
    return root.host.matches(ownedRootSelector);
  }
  return element.matches(ownedRootSelector) || element.closest(ownedRootSelector) !== null;
}

/**
 * Checks whether an element is a known rich code editor container.
 *
 * @param element - The element to inspect.
 * @returns True when the element looks like a code editor surface.
 */
function isCodeEditorElement(element: Element): boolean {
  return element.matches(codeEditorSelector);
}

/**
 * Finds a nested checkbox or radio control inside a composite clickable row.
 *
 * @param element - The element to inspect.
 * @returns The nested checkable input when present.
 */
function findNestedCheckableInput(element: Element): HTMLInputElement | undefined {
  const input = element.querySelector('input[type="checkbox"], input[type="radio"]');
  return input instanceof HTMLInputElement ? input : undefined;
}

/**
 * Finds a writable form control nested in a visible wrapper element.
 *
 * @param element - The wrapper candidate.
 * @param windowObject - The window that owns the document.
 * @returns The nested writable control when present.
 */
function findNestedWritableControl(element: Element, windowObject: Window): Element | undefined {
  const controls = Array.from(element.querySelectorAll(
    'input:not([type="hidden"]),textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable=true]',
  ));

  return controls.find((control) => {
    if (!(control instanceof HTMLElement) || isDisabledElement(control)) return false;
    const style = windowObject.getComputedStyle(control);
    if (control.hidden || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') {
      return false;
    }
    if (control instanceof HTMLInputElement) {
      const type = (control.type || 'text').toLowerCase();
      return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type);
    }
    return true;
  });
}

/**
 * Checks whether an element is itself a writable form control.
 *
 * @param element - The element to inspect.
 * @returns True when the element can accept text-like user input.
 */
function isWritableControlElement(element: Element): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) return true;
  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase();
    return !['button', 'checkbox', 'color', 'file', 'hidden', 'image', 'radio', 'range', 'reset', 'submit'].includes(type);
  }
  return (element as HTMLElement).isContentEditable === true;
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
  if (!isWritableControlElement(element) && !nestedWritable && !isCodeEditorElement(element)) {
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
 * Reads the scroll axis for an element when it is visibly scrollable.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the document.
 * @returns The scroll axis when the element can scroll.
 */
function readScrollAxis(element: Element, windowObject: Window): 'x' | 'y' | 'xy' | undefined {
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
function inferRole(element: Element, windowObject: Window): string | null {
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
function readValueHint(element: Element): string | undefined {
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
function readControlName(element: Element, role: string, windowObject: Window): string {
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
function rectIntersectsViewport(rect: DOMRect, windowObject: Window): boolean {
  return rect.right > 0 && rect.bottom > 0 && rect.left < windowObject.innerWidth && rect.top < windowObject.innerHeight;
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
function passesHitTest(
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
function compactRect(rect: DOMRect): [number, number, number, number] {
  return [Math.round(rect.left), Math.round(rect.top), Math.round(rect.width), Math.round(rect.height)];
}

/**
 * Builds an optional compact metadata object for a candidate.
 *
 * @param element - The candidate element.
 * @param hint - The optional value hint.
 * @returns Compact metadata or undefined when no metadata is useful.
 */
function buildMeta(item: CandidateItem): SnapshotMeta | undefined {
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
function deduplicateNestedCandidates(items: CandidateItem[]): CandidateItem[] {
  return items.filter((item, index) => !items.some((candidate, candidateIndex) => (
    candidateIndex !== index &&
    candidateIndex < index &&
    isNestedDuplicateCandidate(candidate, item)
  )));
}

/**
 * Reads a compact snapshot of interactable elements in the current viewport.
 *
 * @param documentObject - The document to scan.
 * @param windowObject - The window that owns the document.
 * @returns A token-bounded interactables snapshot.
 */
export function readCurrentPageInteractables(
  documentObject: Document = document,
  windowObject: Window = window,
): GetPageInteractablesToolPayload {
  const candidates = Array.from(documentObject.querySelectorAll(candidateSelector));
  const diagnostics = createDiagnostics();
  const items: CandidateItem[] = [];

  for (const element of candidates) {
    diagnostics.q.total += 1;
    if (element.tagName.toLowerCase() === 'p') diagnostics.q.p += 1;

    const nestedWritable = findNestedWritableControl(element, windowObject);
    if (
      element.matches('input:not([type="hidden"]),textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable=true]') ||
      nestedWritable
    ) {
      diagnostics.q.writable += 1;
    }
    if (nestedWritable && nestedWritable !== element) diagnostics.q.wrappers += 1;

    if (isOwnedByChatBrowserX(element)) {
      diagnostics.q.owned += 1;
      addDiagnosticsSample(diagnostics, element, 'owned');
      continue;
    }
    if (isHiddenBySelfOrAncestor(element, windowObject)) {
      diagnostics.q.hidden += 1;
      addDiagnosticsSample(diagnostics, element, 'hidden');
      continue;
    }
    if (isDisabledElement(element)) {
      diagnostics.q.disabled += 1;
      addDiagnosticsSample(diagnostics, element, 'disabled');
      continue;
    }

    const role = inferRole(element, windowObject);
    if (!role) {
      diagnostics.q.noRole += 1;
      addDiagnosticsSample(diagnostics, element, 'noRole');
      continue;
    }

    const rect = element.getBoundingClientRect();
    const compactedRect = compactRect(rect);
    if (rect.width < 2 || rect.height < 2 || !rectIntersectsViewport(rect, windowObject)) {
      diagnostics.q.small += 1;
      addDiagnosticsSample(diagnostics, element, 'small', role, compactedRect);
      continue;
    }
    if (!passesHitTest(element, role, rect, documentObject, windowObject)) {
      diagnostics.q.covered += 1;
      addDiagnosticsSample(diagnostics, element, 'covered', role, compactedRect);
      continue;
    }

    const writableControl = findNestedWritableControl(element, windowObject);
    const scrollAxis = readScrollAxis(element, windowObject);
    const name = readControlName(element, role, windowObject);
    const hint = readValueHint(element);

    const nestedCheckable = findNestedCheckableInput(element);

    items.push({
      element,
      role,
      name,
      hint,
      inputType: isCodeEditorElement(element)
        ? 'code'
        : element instanceof HTMLInputElement
          ? element.type
          : writableControl instanceof HTMLInputElement
            ? writableControl.type
          : undefined,
      checked: element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type)
        ? element.checked
        : nestedCheckable?.checked,
      expanded: element.getAttribute('aria-expanded') === 'true' ? true : undefined,
      pressed: element.getAttribute('aria-pressed') === 'true' ? true : undefined,
      scrollAxis,
      rect: compactedRect,
    });
    diagnostics.q.kept += 1;
    addDiagnosticsSample(diagnostics, element, 'kept', role, compactedRect);
  }

  const deduplicatedItems = deduplicateNestedCandidates(items);

  deduplicatedItems.sort((a, b) => a.rect[1] - b.rect[1] || a.rect[0] - b.rect[0]);

  latestSnapshotRefs = new Map<string, Element>();
  latestSnapshotSid = createSnapshotSid();

  const payload: GetPageInteractablesToolPayload = {
    v: [Math.floor(windowObject.innerWidth), Math.floor(windowObject.innerHeight)],
    sid: latestSnapshotSid,
    items: deduplicatedItems.slice(0, maxItems).map((item, index) => {
      const ref = `e${index + 1}`;
      latestSnapshotRefs.set(ref, item.element);
      const tuple: GetPageInteractablesToolPayload['items'][number] = [ref, item.role, item.name, item.rect];
      const meta = buildMeta(item);
      if (meta) tuple.push(meta);
      return tuple;
    }),
  };

  const hasTextbox = payload.items.some((item) => item[1] === 'textbox' || item[1] === 'searchbox');
  if (!hasTextbox && payload.items.length <= 8 && diagnostics.q.writable > 0) {
    payload.d = {
      ver: diagnosticsVersion,
      q: diagnostics.q,
      samples: diagnostics.samples,
    };
  }

  return payload;
}

/**
 * Checks whether a page action references the latest interactables snapshot.
 *
 * @param sid - The snapshot ID supplied by the action request.
 * @returns True when the snapshot ID matches the latest snapshot.
 */
export function isLatestInteractablesSnapshot(sid: string | undefined): boolean {
  return sid !== undefined && sid === latestSnapshotSid;
}

/**
 * Resolves an element from the latest interactables snapshot.
 *
 * @param ref - The snapshot ref.
 * @returns The element when it is still known.
 */
export function resolveLatestInteractableRef(ref: string): Element | undefined {
  return latestSnapshotRefs.get(ref);
}

/**
 * Registers the content-script listener for page interactables tool requests.
 */
export function registerGetPageInteractablesToolListener(): void {
  const listener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] = (message, _sender, sendResponse) => {
    if (!isGetPageInteractablesToolRequestMessage(message)) {
      return undefined;
    }

    sendResponse(readCurrentPageInteractables(document, window));
    return true;
  };

  chrome.runtime.onMessage.addListener(listener);
}
