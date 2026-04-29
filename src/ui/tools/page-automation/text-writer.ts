import { findCodeEditorSurface } from './dom-targets';

const richEditorWriteRequestEventType = 'chatbrowserx.rich-editor-write.request';
const richEditorWriteResultEventType = 'chatbrowserx.rich-editor-write.result';

/**
 * Writes a value through the native DOM property setter so controlled inputs see the change.
 *
 * @param element - The target form element.
 * @param value - The next value.
 */
function setNativeValue(element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement, value: string): void {
  const descriptor = Object.getOwnPropertyDescriptor(element, 'value');
  const prototype = Object.getPrototypeOf(element) as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const prototypeDescriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
  const setter = prototypeDescriptor?.set && descriptor?.set !== prototypeDescriptor.set
    ? prototypeDescriptor.set
    : descriptor?.set;

  if (setter) {
    setter.call(element, value);
    return;
  }

  element.value = value;
}

/**
 * Creates a synthetic paste event with clipboard text for controls that listen to paste.
 *
 * @param text - Text exposed through clipboardData.
 * @returns A paste event carrying text/plain data.
 */
function createTextPasteEvent(text: string): Event {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  const clipboardData = {
    types: ['text/plain'],
    getData: (type: string) => (type === 'text/plain' || type === 'text' ? text : ''),
    setData: () => true,
    clearData: () => undefined,
  };
  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: clipboardData,
  });
  return event;
}

/**
 * Dispatches a keyboard event with the modifiers browsers use for select-all.
 *
 * @param element - The focused writable element.
 * @param type - The keyboard event type.
 * @param modifier - The platform modifier to mark as active.
 */
function dispatchSelectAllKeyEvent(element: Element, type: 'keydown' | 'keyup', modifier: 'ctrl' | 'meta'): void {
  element.dispatchEvent(new KeyboardEvent(type, {
    bubbles: true,
    cancelable: true,
    key: 'a',
    code: 'KeyA',
    ctrlKey: modifier === 'ctrl',
    metaKey: modifier === 'meta',
  }));
}

/**
 * Gives editor-like controls a chance to replace all existing text on the next insertion.
 *
 * @param element - The focused writable element.
 */
function prepareTextReplacement(element: Element): void {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.select();
    element.setSelectionRange(0, element.value.length);
  }

  dispatchSelectAllKeyEvent(element, 'keydown', 'meta');
  dispatchSelectAllKeyEvent(element, 'keyup', 'meta');
  dispatchSelectAllKeyEvent(element, 'keydown', 'ctrl');
  dispatchSelectAllKeyEvent(element, 'keyup', 'ctrl');

  const documentObject = element.ownerDocument;
  if (typeof documentObject.execCommand === 'function') {
    documentObject.execCommand('selectAll', false);
  }
}

/**
 * Dispatches user-like text insertion signals before the direct DOM fallback.
 *
 * @param element - The focused writable element.
 * @param text - Text to insert.
 */
function dispatchTextInsertionEvents(element: Element, text: string): void {
  element.dispatchEvent(new InputEvent('beforeinput', {
    bubbles: true,
    cancelable: true,
    inputType: 'insertFromPaste',
    data: text,
  }));
  element.dispatchEvent(createTextPasteEvent(text));
}

/**
 * Asks a page-world rich editor bridge to write through the editor model API.
 *
 * @param element - The focused writable element or editor descendant.
 * @param text - Text to write.
 * @param clear - Whether to replace existing content.
 * @returns True when a page-world bridge reports a successful write.
 */
function tryRichEditorBridgeTextInsertion(element: Element, text: string, clear: boolean | undefined): boolean {
  if (!findCodeEditorSurface(element)) return false;

  const id = `cbx-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  let handled = false;
  let ok = false;
  const resultListener = (event: Event) => {
    const detail = (event as CustomEvent<{ id?: string; ok?: boolean }>).detail;
    if (detail?.id !== id) return;
    handled = true;
    ok = detail.ok === true;
  };

  element.addEventListener(richEditorWriteResultEventType, resultListener);
  element.dispatchEvent(new CustomEvent(richEditorWriteRequestEventType, {
    bubbles: true,
    composed: true,
    detail: { id, text, clear: Boolean(clear) },
  }));
  element.removeEventListener(richEditorWriteResultEventType, resultListener);

  if (handled && ok && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
    setNativeValue(element, clear ? text : `${element.value}${text}`);
  }

  return handled && ok;
}

/**
 * Lets the browser editing pipeline insert text before falling back to direct DOM mutation.
 *
 * @param element - The focused writable element.
 * @param text - Text to insert.
 * @param clear - Whether to replace existing content.
 * @returns True when the browser reports that it handled the insertion.
 */
function tryNativeTextInsertion(element: Element, text: string, clear: boolean | undefined): boolean {
  const documentObject = element.ownerDocument;
  if (typeof documentObject.execCommand !== 'function') return false;

  if (clear) {
    prepareTextReplacement(element);
    documentObject.execCommand('delete', false);
  }
  return documentObject.execCommand('insertText', false, text);
}

/**
 * Writes text through the rich-editor, native-editing, and DOM fallback writers.
 *
 * @param element - The target element.
 * @param text - Text to write.
 * @param clear - Whether to replace existing content.
 * @returns True when a writer accepted the text.
 */
export function writeText(element: Element, text: string, clear: boolean | undefined): boolean {
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    element.focus();
    if (tryRichEditorBridgeTextInsertion(element, text, clear)) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (tryNativeTextInsertion(element, text, clear)) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    const nextValue = clear ? text : `${element.value}${text}`;
    if (clear) prepareTextReplacement(element);
    dispatchTextInsertionEvents(element, text);
    setNativeValue(element, nextValue);
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (element instanceof HTMLSelectElement) {
    element.focus();
    setNativeValue(element, text);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  if (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '')
  ) {
    element.focus();
    if (tryRichEditorBridgeTextInsertion(element, text, clear)) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    if (tryNativeTextInsertion(element, text, clear)) {
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
    const nextText = clear ? text : `${element.textContent ?? ''}${text}`;
    if (clear) prepareTextReplacement(element);
    dispatchTextInsertionEvents(element, text);
    element.textContent = nextText;
    element.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  return false;
}
