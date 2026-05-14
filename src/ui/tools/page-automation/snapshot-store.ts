export interface SnapshotTarget {
  element: Element;
  role?: string;
  canOperate?: boolean;
  canWrite?: boolean;
}

type SnapshotSource = Element | SnapshotTarget;

let latestSnapshotRefs = new Map<string, SnapshotTarget>();
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
 * Normalizes an element or candidate-like item into stored snapshot target metadata.
 *
 * @param source - The snapshot source to store.
 * @returns A stored target with compact action capability metadata.
 */
function normalizeSnapshotSource(source: SnapshotSource): SnapshotTarget {
  if (source instanceof Element) return { element: source };
  return {
    element: source.element,
    role: source.role,
    canOperate: source.canOperate,
    canWrite: source.canWrite,
  };
}

/**
 * Replaces the latest interactables snapshot with a new ordered element list.
 *
 * @param sources - Elements or candidate items in the order exposed to the model.
 * @returns The new snapshot ID and generated refs.
 */
export function replaceLatestInteractablesSnapshot(sources: SnapshotSource[]): { sid: string; refs: string[] } {
  const sid = createSnapshotSid();
  const refs = sources.map((_element, index) => `e${index + 1}`);

  latestSnapshotRefs = new Map(refs.map((ref, index) => [ref, normalizeSnapshotSource(sources[index])]));
  latestSnapshotSid = sid;

  return { sid, refs };
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
  return latestSnapshotRefs.get(ref)?.element;
}

/**
 * Resolves an element and its stored snapshot metadata by ref.
 *
 * @param ref - The snapshot ref.
 * @returns The stored snapshot target when it is still known.
 */
export function resolveLatestInteractableTarget(ref: string): SnapshotTarget | undefined {
  return latestSnapshotRefs.get(ref);
}
