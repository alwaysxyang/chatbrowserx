import type { GetPageInteractablesToolPayload } from '../../../shared/types/tools';
import {
  buildMeta,
  diagnosticsVersion,
  findNestedCheckableInput,
  maxItems,
  type CandidateItem,
} from './interactable-candidate';
import { deduplicateNestedCandidates } from './interactable-deduplication';
import { compactRect, rectIntersectsViewport, type CompactRect } from './geometry';
import { candidateSelector, inferRole, readScrollAxis } from './interactable-role';
import { passesHitTest } from './interactable-visibility';
import {
  readControlName,
  readValueHint,
} from './interactable-naming';
import {
  addDiagnosticsSample,
  createDiagnostics,
} from './interactable-diagnostics';
import {
  findCodeEditorSurface,
  findNestedWritableControl,
  isCodeEditorElement,
  isDisabledElement,
  isHiddenBySelfOrAncestor,
  isOwnedByChatBrowserX,
} from './dom-targets';
import { replaceLatestInteractablesSnapshot } from './snapshot-store';

/**
 * Builds a candidate item after all visibility and role filters have passed.
 *
 * @param element - The candidate DOM element.
 * @param role - The inferred interactable role.
 * @param compactedRect - The compact candidate geometry.
 * @param windowObject - The window that owns the element.
 * @returns A candidate item for sorting and serialization.
 */
function buildCandidateItem(
  element: Element,
  role: string,
  compactedRect: CompactRect,
  windowObject: Window,
): CandidateItem {
  const writableControl = findNestedWritableControl(element, windowObject);
  const nestedCheckable = findNestedCheckableInput(element);

  return {
    element,
    role,
    name: readControlName(element, role, windowObject),
    hint: readValueHint(element),
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
    scrollAxis: readScrollAxis(element, windowObject),
    rect: compactedRect,
  };
}

/**
 * Updates diagnostics with common pre-role candidate counters.
 *
 * @param element - The candidate DOM element.
 * @param windowObject - The window that owns the element.
 * @param diagnostics - Mutable diagnostics state.
 */
function recordCandidateDiagnostics(
  element: Element,
  windowObject: Window,
  diagnostics: ReturnType<typeof createDiagnostics>,
): void {
  if (element.tagName.toLowerCase() === 'p') diagnostics.q.p += 1;

  const nestedWritable = findNestedWritableControl(element, windowObject);
  if (
    element.matches('input:not([type="hidden"]),textarea,select,[contenteditable=""],[contenteditable="true"],[contenteditable=true]') ||
    nestedWritable
  ) {
    diagnostics.q.writable += 1;
  }
  if (nestedWritable && nestedWritable !== element) diagnostics.q.wrappers += 1;
}

/**
 * Serializes exposed candidates and stores their latest ref mapping.
 *
 * @param items - Deduplicated candidate items.
 * @param windowObject - The window used for viewport dimensions.
 * @returns A token-bounded interactables snapshot.
 */
function serializeSnapshot(items: CandidateItem[], windowObject: Window): GetPageInteractablesToolPayload {
  const exposedItems = items.slice(0, maxItems);
  const snapshot = replaceLatestInteractablesSnapshot(exposedItems.map((item) => item.element));

  return {
    v: [Math.floor(windowObject.innerWidth), Math.floor(windowObject.innerHeight)],
    sid: snapshot.sid,
    items: exposedItems.map((item, index) => {
      const ref = snapshot.refs[index];
      const tuple: GetPageInteractablesToolPayload['items'][number] = [ref, item.role, item.name, item.rect];
      const meta = buildMeta(item);
      if (meta) tuple.push(meta);
      return tuple;
    }),
  };
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
  const candidates = Array.from(new Set(
    Array.from(documentObject.querySelectorAll(candidateSelector)).map((element) => findCodeEditorSurface(element) ?? element),
  ));
  const diagnostics = createDiagnostics();
  const items: CandidateItem[] = [];

  for (const element of candidates) {
    diagnostics.q.total += 1;
    recordCandidateDiagnostics(element, windowObject, diagnostics);

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

    const item = buildCandidateItem(element, role, compactedRect, windowObject);
    items.push(item);
    diagnostics.q.kept += 1;
    addDiagnosticsSample(diagnostics, element, 'kept', role, compactedRect);
  }

  const deduplicatedItems = deduplicateNestedCandidates(items);
  deduplicatedItems.sort((a, b) => a.rect[1] - b.rect[1] || a.rect[0] - b.rect[0]);

  const payload = serializeSnapshot(deduplicatedItems, windowObject);
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
