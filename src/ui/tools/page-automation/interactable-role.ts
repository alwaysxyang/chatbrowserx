import { isCodeEditorElement } from './dom-targets';
import { hasDirectSemanticControlToken } from './interactable-naming';
import { isNestedWritableTextboxWrapper } from './interactable-textbox-wrapper';

export const candidateSelector = [
  'a[href]',
  'button',
  'input:not([type="hidden"])',
  'textarea',
  'select',
  'summary',
  'label',
  'main',
  'p:has(> input:not([type="hidden"]))',
  'p:has(> select)',
  'p:has(> textarea)',
  'p:has(> [contenteditable])',
  '[style*="overflow" i]',
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
  '[class*="btn" i]',
  '[class*="button" i]',
  '[class*="click" i]',
  '[class*="cursor" i]',
  '[class*="field" i]',
  '[class*="form-item" i]',
  '[class*="form_item" i]',
  '[class*="input" i]',
  '[class*="picker" i]',
  '[class*="list" i]',
  '[class*="menu" i]',
  '[class*="menu-item" i]',
  '[class*="option" i]',
  '[class*="date" i]',
  '[class*="day" i]',
  '[class*="pointer" i]',
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

/**
 * Reads a lowercase class string from an element.
 *
 * @param element - The element to inspect.
 * @returns A lowercase class string.
 */
function readClassName(element: Element): string {
  return typeof element.className === 'string' ? element.className.toLowerCase() : '';
}

/**
 * Checks whether an element class contains a token common to choice controls.
 *
 * @param element - The element to inspect.
 * @returns True when the class hints at a picker, selector, or popup list.
 */
function hasChoiceClassToken(element: Element): boolean {
  const className = readClassName(element);
  return /(^|[-_\s])(picker|selector|select|dropdown|listbox|menu|option)([-_\s]|$)/.test(className);
}

/**
 * Checks whether an element class looks like a date grid choice.
 *
 * @param element - The element to inspect.
 * @returns True when the class suggests a date or day option inside a picker popup.
 */
function hasTemporalChoiceClassToken(element: Element): boolean {
  const className = readClassName(element);
  return /(^|[-_\s])(date|day)([-_\s]|$)/.test(className);
}

/**
 * Reads compact visible-like text for option shape heuristics.
 *
 * @param element - The element to inspect.
 * @returns Whitespace-collapsed text content.
 */
function readCompactTextContent(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, '').trim();
}

/**
 * Checks whether an element itself has date-grid option semantics.
 *
 * @param element - The element to inspect.
 * @returns True when the element looks like a selectable temporal cell.
 */
function hasTemporalChoiceSignal(element: Element): boolean {
  const role = element.getAttribute('role')?.trim().split(/\s+/)[0]?.toLowerCase();
  return role === 'gridcell' || hasTemporalChoiceClassToken(element);
}

/**
 * Checks whether a temporal-looking element is only a container around real cells.
 *
 * @param element - The element to inspect.
 * @returns True when a descendant carries the actual date or day choice signal.
 */
function hasNestedTemporalChoiceSignal(element: Element): boolean {
  return Array.from(element.querySelectorAll('[role], [class*="date" i], [class*="day" i]'))
    .some((descendant) => descendant !== element && hasTemporalChoiceSignal(descendant));
}

/**
 * Checks whether an element is a leaf-like date or day option in a picker popup.
 *
 * @param element - The element to inspect.
 * @returns True when the element should be exposed as an individual temporal option.
 */
function isTemporalPopupOption(element: Element): boolean {
  const role = element.getAttribute('role')?.trim().split(/\s+/)[0]?.toLowerCase();
  if (role === 'gridcell') return true;
  if (!hasTemporalChoiceClassToken(element)) return false;
  if (hasNestedTemporalChoiceSignal(element)) return false;

  const compactText = readCompactTextContent(element);
  return compactText.length > 0 && compactText.length <= 8;
}

/**
 * Checks whether an element is a broad picker panel around temporal cells.
 *
 * @param element - The element to inspect.
 * @returns True when descendants, not this element, should carry date/time actions.
 */
function isBroadTemporalPickerContainer(element: Element): boolean {
  if (!hasNestedTemporalChoiceSignal(element)) return false;
  return hasTemporalChoiceClassToken(element) || hasChoiceClassToken(element);
}

/**
 * Checks whether the element declares popup semantics for choosing from a menu.
 *
 * @param element - The element to inspect.
 * @returns True when the element advertises a popup choice surface.
 */
function hasChoicePopupSignal(element: Element): boolean {
  const popup = element.getAttribute('aria-haspopup')?.toLowerCase();
  return ['true', 'listbox', 'menu', 'tree', 'grid', 'dialog'].includes(popup ?? '') ||
    element.hasAttribute('aria-controls') ||
    element.hasAttribute('aria-expanded');
}

/**
 * Checks whether a non-native surface can be activated from keyboard focus.
 *
 * @param element - The element to inspect.
 * @returns True when the element is focusable through a non-negative tabindex.
 */
function hasKeyboardActivationSignal(element: Element): boolean {
  const tabIndex = element.getAttribute('tabindex');
  return tabIndex !== null && Number(tabIndex) >= 0;
}

/**
 * Checks whether a text input is readonly and used as a picker display field.
 *
 * @param element - The element to inspect.
 * @returns True when the input cannot receive direct text writes.
 */
function isReadonlyPickerInput(element: Element): boolean {
  const tagName = element.tagName.toLowerCase();
  if (tagName !== 'input' && tagName !== 'textarea') return false;

  return Boolean((element as HTMLInputElement | HTMLTextAreaElement).readOnly) ||
    element.hasAttribute('readonly') ||
    element.getAttribute('aria-readonly') === 'true';
}

/**
 * Checks whether a compact element wraps an internal text input for choice filtering.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the element.
 * @returns True when the nested input appears to be implementation detail, not the primary target.
 */
function hasInternalChoiceInput(element: Element, windowObject: Window): boolean {
  const input = element.querySelector('input:not([type="hidden"]), textarea');
  if (!input) return false;

  const rect = element.getBoundingClientRect();
  const isCompact = rect.height <= 160 && rect.width <= Math.max(windowObject.innerWidth * 0.95, 1);
  return isCompact && (input.getAttribute('tabindex') === '-1' || isReadonlyPickerInput(input));
}

/**
 * Checks whether a compact choice surface displays a readonly internal field.
 *
 * @param element - The element to inspect.
 * @returns True when a nested readonly control is used as display state for a picker.
 */
function hasReadonlyInternalChoiceInput(element: Element): boolean {
  const input = element.querySelector('input:not([type="hidden"]), textarea');
  return Boolean(input && isReadonlyPickerInput(input));
}

/**
 * Checks whether the element should be exposed as a composite choice surface.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the element.
 * @returns True when the element is a picker surface that should open choices.
 */
function isCompositeChoiceSurface(element: Element, windowObject: Window): boolean {
  if (!hasInternalChoiceInput(element, windowObject)) return false;
  if (hasChoicePopupSignal(element)) return true;
  if (hasKeyboardActivationSignal(element) && hasChoiceClassToken(element)) return true;

  return hasChoiceClassToken(element) && hasReadonlyInternalChoiceInput(element);
}

/**
 * Checks whether an input is an implementation detail of a composite choice surface.
 *
 * @param element - The element to inspect.
 * @param windowObject - The window that owns the element.
 * @returns True when the input should be represented by its picker surface.
 */
function isCompositeChoiceInnerInput(element: Element, windowObject: Window): boolean {
  if (isReadonlyPickerInput(element) && hasChoiceClassToken(element)) return true;
  if (element.getAttribute('tabindex') !== '-1' && !isReadonlyPickerInput(element)) return false;

  let ancestor = element.parentElement;
  while (ancestor) {
    if (isCompositeChoiceSurface(ancestor, windowObject)) return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

/**
 * Checks whether an element is inside an ARIA choice list.
 *
 * @param element - The element to inspect.
 * @returns True when an ancestor exposes listbox or menu semantics.
 */
function isInsideChoiceList(element: Element): boolean {
  let ancestor = element.parentElement;
  while (ancestor) {
    const role = ancestor.getAttribute('role')?.trim().split(/\s+/)[0]?.toLowerCase();
    if (role === 'listbox' || role === 'menu' || role === 'grid' || role === 'tree') return true;
    if (hasChoiceClassToken(ancestor)) return true;
    ancestor = ancestor.parentElement;
  }
  return false;
}

/**
 * Checks whether a popup option or its nearby row is disabled.
 *
 * @param element - The element to inspect.
 * @returns True when a self or ancestor state marks the option unavailable.
 */
function hasDisabledChoiceState(element: Element): boolean {
  let current: Element | null = element;
  let depth = 0;

  while (current && depth < 4) {
    if (current.getAttribute('aria-disabled') === 'true') return true;
    if (/(^|[-_\s])(disabled|unavailable)([-_\s]|$)/.test(readClassName(current))) return true;
    current = current.parentElement;
    depth += 1;
  }

  return false;
}

/**
 * Checks whether the element is a selectable row inside a composite popup.
 *
 * @param element - The element to inspect.
 * @returns True when the row should be exposed as an option.
 */
function isCompositePopupOption(element: Element): boolean {
  const className = readClassName(element);
  const hasOptionClass = className.includes('menu-item') || className.includes('option');
  const isChoiceCell = isTemporalPopupOption(element);
  return (hasOptionClass || isChoiceCell) && !hasDisabledChoiceState(element) && isInsideChoiceList(element);
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
 * @param windowObject - The window that owns the element.
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
    if (isCompositeChoiceInnerInput(element, windowObject)) return null;
    const type = ((element as HTMLInputElement).type || 'text').toLowerCase();
    if (type === 'checkbox') return 'checkbox';
    if (type === 'radio') return 'radio';
    if (type === 'range') return 'slider';
    if (['button', 'submit', 'reset', 'image'].includes(type)) return 'button';
    return 'textbox';
  }

  if ((element as HTMLElement).isContentEditable) return 'textbox';
  if (isBroadTemporalPickerContainer(element)) return null;
  if (isCompositeChoiceSurface(element, windowObject)) return 'combobox';
  if (isCompositePopupOption(element)) return 'option';
  if (isNestedWritableTextboxWrapper(element, element.getBoundingClientRect(), windowObject)) return 'textbox';
  if (readScrollAxis(element, windowObject)) return 'scrollarea';
  if (explicitRole) return null;
  if (hasDirectSemanticControlToken(element)) return 'button';
  if (hasGenericClickAffordance(element, windowObject)) return 'button';
  return null;
}
