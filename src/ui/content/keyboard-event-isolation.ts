/**
 * Checks whether a keyboard event is a platform select-all shortcut.
 *
 * @param event - The keyboard event to inspect.
 * @returns True when the event asks to select all text.
 */
function isSelectAllShortcut(event: KeyboardEvent): boolean {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a';
}

/**
 * Checks whether a target supports scoped text selection.
 *
 * @param target - The event target to inspect.
 * @returns True when the target is a text input surface.
 */
function isSelectableTextTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement | HTMLElement {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && (target.isContentEditable || target.getAttribute('contenteditable') === 'true' || target.getAttribute('contenteditable') === ''));
}

/**
 * Selects text inside the focused target without selecting the host page.
 *
 * @param target - The target text input surface.
 */
function selectTargetText(target: HTMLInputElement | HTMLTextAreaElement | HTMLElement): void {
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    target.select();
    target.setSelectionRange(0, target.value.length);
    return;
  }

  const documentObject = target.ownerDocument;
  const selection = documentObject.defaultView?.getSelection();
  if (!selection) return;

  const range = documentObject.createRange();
  range.selectNodeContents(target);
  selection.removeAllRanges();
  selection.addRange(range);
}

/**
 * Installs a keyboard boundary for the content ShadowRoot so host pages cannot consume plugin input shortcuts.
 *
 * @param shadowRoot - The ShadowRoot that contains ChatBrowserX UI.
 * @returns A cleanup function that removes the installed listeners.
 */
export function installContentKeyboardEventIsolation(shadowRoot: ShadowRoot): () => void {
  const handleKeyboardEvent = (event: Event) => {
    if (!(event instanceof KeyboardEvent)) return;

    const target = event.composedPath()[0] ?? event.target;
    if (event.type === 'keydown' && isSelectAllShortcut(event) && isSelectableTextTarget(target)) {
      event.preventDefault();
      selectTargetText(target);
    }

    event.stopPropagation();
    event.stopImmediatePropagation();
  };

  shadowRoot.addEventListener('keydown', handleKeyboardEvent);
  shadowRoot.addEventListener('keyup', handleKeyboardEvent);
  shadowRoot.addEventListener('keypress', handleKeyboardEvent);

  return () => {
    shadowRoot.removeEventListener('keydown', handleKeyboardEvent);
    shadowRoot.removeEventListener('keyup', handleKeyboardEvent);
    shadowRoot.removeEventListener('keypress', handleKeyboardEvent);
  };
}
