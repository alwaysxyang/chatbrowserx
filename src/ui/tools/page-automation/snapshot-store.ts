let latestSnapshotRefs = new Map<string, Element>();
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
 * Replaces the latest interactables snapshot with a new ordered element list.
 *
 * @param elements - Elements in the order exposed to the model.
 * @returns The new snapshot ID and generated refs.
 */
export function replaceLatestInteractablesSnapshot(elements: Element[]): { sid: string; refs: string[] } {
  const sid = createSnapshotSid();
  const refs = elements.map((_element, index) => `e${index + 1}`);

  latestSnapshotRefs = new Map(refs.map((ref, index) => [ref, elements[index]]));
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
  return latestSnapshotRefs.get(ref);
}
