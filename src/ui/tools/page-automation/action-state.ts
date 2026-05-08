import type { PageActionElementState } from '../../../shared/types/tools';

/**
 * Truncates action telemetry text so tool results stay compact.
 *
 * @param value - Text to truncate.
 * @returns A single-line text sample.
 */
function truncateStateText(value: string): string {
  const normalized = value.replace(/\s+/g, ' ').trim();
  return normalized.length > 120 ? normalized.slice(0, 120).trim() : normalized;
}

/**
 * Reads a compact measurable state for an action target.
 *
 * @param element - The element to inspect.
 * @returns State fields that can help the model verify an action.
 */
export function readElementState(element: Element): PageActionElementState | undefined {
  const state: PageActionElementState = {};

  if (element instanceof HTMLInputElement) {
    if (element.type === 'checkbox' || element.type === 'radio') {
      state.checked = element.checked;
    } else {
      state.value = element.value;
    }
  } else if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    state.value = element.value;
  } else if (
    element instanceof HTMLElement &&
    (element.isContentEditable || element.getAttribute('contenteditable') === 'true' || element.getAttribute('contenteditable') === '')
  ) {
    state.text = truncateStateText(element.textContent ?? '');
  }

  const ariaChecked = element.getAttribute('aria-checked');
  const ariaExpanded = element.getAttribute('aria-expanded');
  const ariaPressed = element.getAttribute('aria-pressed');
  if (state.checked === undefined && (ariaChecked === 'true' || ariaChecked === 'false')) {
    state.checked = ariaChecked === 'true';
  }
  if (ariaExpanded === 'true' || ariaExpanded === 'false') {
    state.expanded = ariaExpanded === 'true';
  }
  if (ariaPressed === 'true' || ariaPressed === 'false') {
    state.pressed = ariaPressed === 'true';
  }

  return Object.keys(state).length ? state : undefined;
}

/**
 * Finds the nearest element that exposes checkable, expandable, or pressable state.
 *
 * @param element - The action target or one of its descendants.
 * @returns The nearest stateful element or the original element.
 */
export function resolveStateElement(element: Element): Element {
  const label = element.closest('label') as HTMLLabelElement | null;
  if (label?.control) return label.control;

  const stateful = element.closest('[aria-checked], [aria-expanded], [aria-pressed]');
  if (stateful) return stateful;

  if (element instanceof HTMLLabelElement && element.control) return element.control;
  const nestedInput = element.querySelector('input[type="checkbox"], input[type="radio"]');
  return nestedInput ?? element;
}

/**
 * Compares two compact element states.
 *
 * @param before - State before the action.
 * @param after - State after the action.
 * @returns True when at least one measurable field changed.
 */
export function didStateChange(
  before: PageActionElementState | undefined,
  after: PageActionElementState | undefined,
): boolean {
  return JSON.stringify(before ?? {}) !== JSON.stringify(after ?? {});
}
