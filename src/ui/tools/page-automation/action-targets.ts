import type { PageActionToolResult } from '../../../shared/types/tools';
import { isLatestInteractablesSnapshot, resolveLatestInteractableRef } from './snapshot-store';

/**
 * Resolves a required ref to a currently usable element.
 *
 * @param ref - The latest snapshot ref.
 * @param sid - The latest snapshot ID.
 * @returns The element and rectangle, or an error result.
 */
export function resolveActionTarget(
  ref: string | undefined,
  sid: string | undefined,
): { element: Element; rect: DOMRect } | PageActionToolResult {
  if (!ref) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_REF_REQUIRED' };
  }

  if (!sid) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_SNAPSHOT_REQUIRED' };
  }

  if (!isLatestInteractablesSnapshot(sid)) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_SNAPSHOT_EXPIRED' };
  }

  const element = resolveLatestInteractableRef(ref);
  if (!element) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_REF_NOT_FOUND' };
  }

  const rect = element.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2) {
    return { ok: false, action: 'click', ref, error: 'PAGE_ACTION_TARGET_UNAVAILABLE' };
  }

  return { element, rect };
}

/**
 * Returns the deepest focused element, including focus inside open shadow roots.
 *
 * @param documentObject - The document that owns the action.
 * @returns The currently focused element, or undefined when focus is only on the page shell.
 */
export function readFocusedElement(documentObject: Document): Element | undefined {
  let activeElement: Element | null = documentObject.activeElement;

  while (activeElement?.shadowRoot?.activeElement) {
    activeElement = activeElement.shadowRoot.activeElement;
  }

  if (!activeElement || activeElement === documentObject.body || activeElement === documentObject.documentElement) {
    return undefined;
  }

  return activeElement;
}
