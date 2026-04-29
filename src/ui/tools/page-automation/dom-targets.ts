const textInputExcludedTypes = [
  'button',
  'checkbox',
  'color',
  'file',
  'hidden',
  'image',
  'radio',
  'range',
  'reset',
  'submit',
];

const writableTargetSelector = [
  'input:not([type="hidden"])',
  'textarea',
  'select',
  '[contenteditable=""]',
  '[contenteditable="true"]',
  '[contenteditable=true]',
].join(',');

const codeEditorRootSelector = [
  '.monaco-editor',
  '.monaco-diff-editor',
  '.cm-editor',
  '.CodeMirror',
  '.ace_editor',
  '[data-mode-id]',
].join(',');

const codeEditorDescendantSelector = [
  '.monaco-mouse-cursor-text',
  '.view-lines',
  '.view-line',
  '.lines-content',
  '.monaco-scrollable-element',
  '.overflow-guard',
  '.inputarea',
].join(',');

const ownedRootSelector = '#chatbrowserx-root,#chatbrowserx-page-action-overlay,#chatbrowserx-subtitle-container';

/**
 * Checks whether an element or ancestor is hidden from users or the accessibility tree.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the document.
 * @returns True if the element should be skipped.
 */
export function isHiddenBySelfOrAncestor(element: Element, windowObject: Window): boolean {
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
export function isDisabledElement(element: Element): boolean {
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
export function isOwnedByChatBrowserX(element: Element): boolean {
  const root = element.getRootNode();
  if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot && root.host instanceof Element) {
    return root.host.matches(ownedRootSelector);
  }
  return element.matches(ownedRootSelector) || element.closest(ownedRootSelector) !== null;
}

/**
 * Finds the stable editor surface for a known rich code editor element or descendant.
 *
 * @param element - The element to inspect.
 * @returns The outer editor surface when present.
 */
export function findCodeEditorSurface(element: Element): Element | undefined {
  if (element.matches(codeEditorRootSelector)) return element;

  const root = element.closest(codeEditorRootSelector);
  if (root) return root;

  if (!element.matches(codeEditorDescendantSelector)) return undefined;

  for (let current = element.parentElement; current; current = current.parentElement) {
    if (
      current.querySelector(codeEditorDescendantSelector) &&
      current.querySelector(writableTargetSelector)
    ) {
      return current;
    }
  }

  return undefined;
}

/**
 * Checks whether an element is a known rich code editor surface.
 *
 * @param element - The element to inspect.
 * @returns True when the element looks like a code editor surface.
 */
export function isCodeEditorElement(element: Element): boolean {
  return findCodeEditorSurface(element) === element;
}

/**
 * Checks whether an element is a text-like writable target.
 *
 * @param element - The element to inspect.
 * @returns True when the element can receive direct text writes.
 */
export function isWritableTextElement(element: Element): boolean {
  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase();
    return !textInputExcludedTypes.includes(type);
  }

  return element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement ||
    (element instanceof HTMLElement && (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === ''));
}

/**
 * Returns true when a writable target is currently usable for text input.
 *
 * @param element - The candidate element.
 * @param windowObject - The window that owns the element.
 * @returns True when the element should receive text writes.
 */
export function isUsableTextTarget(element: Element, windowObject: Window): boolean {
  if (!isWritableTextElement(element) || isDisabledElement(element)) return false;

  const htmlElement = element as HTMLElement;
  const style = windowObject.getComputedStyle(htmlElement);
  return !htmlElement.hidden && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse';
}

/**
 * Finds a writable form control nested in a visible wrapper element.
 *
 * @param element - The wrapper candidate.
 * @param windowObject - The window that owns the document.
 * @returns The nested writable control when present.
 */
export function findNestedWritableControl(element: Element, windowObject: Window): Element | undefined {
  const controls = Array.from(element.querySelectorAll(writableTargetSelector));
  return controls.find((control) => isUsableTextTarget(control, windowObject));
}

/**
 * Finds the best writable descendant for composite editor containers or form rows.
 *
 * @param element - The requested action target.
 * @param windowObject - The window that owns the element.
 * @returns A writable element when available.
 */
export function resolveTextTarget(element: Element, windowObject: Window): Element {
  if (isUsableTextTarget(element, windowObject)) return element;
  const codeEditor = findCodeEditorSurface(element);
  if (codeEditor) return findNestedWritableControl(codeEditor, windowObject) ?? codeEditor;
  return findNestedWritableControl(element, windowObject) ?? element;
}
