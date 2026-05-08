import type { GetPageInteractablesToolPayload } from '../../../shared/types/tools';
import type { CompactRect } from './geometry';

export const maxItems = 60;
export const diagnosticsVersion = 'aria-20260428.2';

export interface CandidateItem {
  element: Element;
  role: string;
  name: string;
  hint?: string;
  inputType?: string;
  checked?: boolean;
  expanded?: boolean;
  pressed?: boolean;
  scrollAxis?: 'x' | 'y' | 'xy';
  rect: CompactRect;
}

type SnapshotMeta = NonNullable<GetPageInteractablesToolPayload['items'][number][4]>;

/**
 * Finds a nested checkbox or radio control inside a composite clickable row.
 *
 * @param element - The element to inspect.
 * @returns The nested checkable input when present.
 */
export function findNestedCheckableInput(element: Element): HTMLInputElement | undefined {
  const input = element.querySelector('input[type="checkbox"], input[type="radio"]');
  return input instanceof HTMLInputElement ? input : undefined;
}

/**
 * Builds an optional compact metadata object for a candidate.
 *
 * @param item - The candidate item.
 * @returns Compact metadata or undefined when no metadata is useful.
 */
export function buildMeta(item: CandidateItem): SnapshotMeta | undefined {
  const meta: SnapshotMeta = {};

  if (item.hint) meta.h = item.hint;
  if (item.inputType) meta.t = item.inputType;
  if (item.checked !== undefined) meta.checked = item.checked;
  if (item.expanded !== undefined) meta.expanded = item.expanded;
  if (item.pressed !== undefined) meta.pressed = item.pressed;
  if (item.scrollAxis !== undefined) meta.s = item.scrollAxis;

  return Object.keys(meta).length > 0 ? meta : undefined;
}
