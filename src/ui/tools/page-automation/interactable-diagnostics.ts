import type { GetPageElementsToolPayload } from '../../../shared/types/tools';
import { truncateText } from './interactable-text';

export interface InteractablesDiagnostics {
  q: NonNullable<GetPageElementsToolPayload['d']>['q'];
  samples: NonNullable<GetPageElementsToolPayload['d']>['samples'];
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
