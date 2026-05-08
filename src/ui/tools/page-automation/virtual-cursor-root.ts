import type { ViewportPoint } from './geometry';

export type CursorMode = 'pointer' | 'hand';

const moveDurationMs = 280;
const settleDurationMs = 180;
const cursorTransition = `transform ${moveDurationMs}ms ease, opacity 120ms ease, scale 120ms ease`;

/**
 * Waits for a short animation duration.
 *
 * @param durationMs - Duration to wait.
 */
export function waitForAnimation(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

/**
 * Creates a role-tagged overlay div with inline styles.
 *
 * @param documentObject - The document that owns the element.
 * @param role - The data role used by tests and styles.
 * @param styleDeclarations - CSS declarations to join into `style.cssText`.
 * @param textContent - Optional text content for simple cues.
 * @returns The configured overlay element.
 */
export function createOverlayElement(
  documentObject: Document,
  role: string,
  styleDeclarations: string[],
  textContent?: string,
): HTMLDivElement {
  const element = documentObject.createElement('div');
  element.dataset.role = role;
  element.style.cssText = styleDeclarations.join(';');
  if (textContent !== undefined) {
    element.textContent = textContent;
  }
  return element;
}

/**
 * Creates an SVG icon element for the virtual cursor.
 *
 * @param documentObject - The document that owns the icon.
 * @param role - The data role used by tests and styles.
 * @param pathData - SVG path data for the icon shape.
 * @returns The configured SVG element.
 */
function createCursorIcon(documentObject: Document, role: string, pathData: string): SVGSVGElement {
  const icon = documentObject.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.dataset.role = role;
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.style.cssText = [
    'position:absolute',
    'left:0',
    'top:0',
    'width:28px',
    'height:28px',
    'filter:drop-shadow(0 2px 5px rgba(0,0,0,0.28))',
  ].join(';');

  const path = documentObject.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', pathData);
  path.setAttribute('fill', '#ffffff');
  path.setAttribute('stroke', '#1677ff');
  path.setAttribute('stroke-width', '1.8');
  path.setAttribute('stroke-linejoin', 'round');
  path.setAttribute('stroke-linecap', 'round');
  icon.appendChild(path);

  return icon;
}

/**
 * Ensures the virtual mouse overlay root exists.
 *
 * @param documentObject - The document that owns the overlay.
 * @returns The overlay root element.
 */
export function ensureOverlayRoot(documentObject: Document): HTMLElement {
  let root = documentObject.getElementById('chatbrowserx-page-action-overlay') as HTMLElement | null;
  if (root) return root;

  root = createOverlayElement(documentObject, 'page-action-overlay-root', [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'pointer-events:none',
    'contain:layout style paint',
  ]);
  root.id = 'chatbrowserx-page-action-overlay';

  const cursor = createOverlayElement(documentObject, 'virtual-cursor', [
    'position:absolute',
    'left:0',
    'top:0',
    'width:28px',
    'height:28px',
    'opacity:0',
    'transform:translate(-9999px,-9999px)',
    `transition:${cursorTransition}`,
    'scale:1',
    'will-change:transform',
  ]);
  cursor.dataset.mode = 'pointer';
  cursor.appendChild(createCursorIcon(
    documentObject,
    'virtual-cursor-pointer',
    'M4 3L20 13.2L13 15.1L9.8 21L6.9 19.5L10 14L4 16.2Z',
  ));
  const hand = createCursorIcon(
    documentObject,
    'virtual-cursor-hand',
    'M8 11V5.5A1.7 1.7 0 0 1 11.4 5.5V10M11.4 10V4.7A1.7 1.7 0 0 1 14.8 4.7V10M14.8 10V6A1.7 1.7 0 0 1 18.2 6V14.2A5 5 0 0 1 13.2 19.2H11.2A5 5 0 0 1 7.5 17.7L4.8 14.9A1.8 1.8 0 0 1 7.3 12.3L8 13',
  );
  hand.style.display = 'none';
  cursor.appendChild(hand);
  root.appendChild(cursor);
  documentObject.documentElement.appendChild(root);
  return root;
}

/**
 * Updates which virtual cursor icon is visible.
 *
 * @param cursor - The cursor container.
 * @param mode - The cursor mode to display.
 */
function setCursorMode(cursor: HTMLElement, mode: CursorMode): void {
  cursor.dataset.mode = mode;
  const pointer = cursor.querySelector<SVGElement>('[data-role="virtual-cursor-pointer"]');
  const hand = cursor.querySelector<SVGElement>('[data-role="virtual-cursor-hand"]');
  if (pointer) pointer.style.display = mode === 'pointer' ? 'block' : 'none';
  if (hand) hand.style.display = mode === 'hand' ? 'block' : 'none';
}

/**
 * Makes the virtual cursor visible before an action animation.
 *
 * @param cursor - The cursor container.
 */
function showCursor(cursor: HTMLElement): void {
  cursor.dataset.hidden = 'false';
  cursor.style.opacity = '1';
}

/**
 * Hides the virtual cursor after a short visible settle period.
 *
 * @param cursor - The cursor container.
 */
export async function hideVirtualCursor(cursor: HTMLElement): Promise<void> {
  if (cursor.dataset.hidden === 'true') return;
  await waitForAnimation(settleDurationMs);
  cursor.dataset.hidden = 'true';
  cursor.style.opacity = '0';
  cursor.style.scale = '1';
  await waitForAnimation(120);
}

/**
 * Moves the virtual cursor to a viewport point using the requested icon.
 *
 * @param documentObject - The document that owns the overlay.
 * @param point - The viewport point.
 * @param mode - The cursor mode to display while moving.
 */
export async function moveVirtualCursor(documentObject: Document, point: ViewportPoint, mode: CursorMode): Promise<void> {
  const root = ensureOverlayRoot(documentObject);
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (!cursor) return;
  setCursorMode(cursor, mode);
  const nextTransform = `translate(${Math.round(point.x)}px, ${Math.round(point.y)}px)`;
  if (cursor.dataset.positioned !== 'true') {
    cursor.style.transition = 'opacity 120ms ease, scale 120ms ease';
    cursor.style.transform = nextTransform;
    cursor.dataset.positioned = 'true';
    void cursor.offsetWidth;
    showCursor(cursor);
    cursor.style.transition = cursorTransition;
  } else {
    showCursor(cursor);
    cursor.style.transform = nextTransform;
  }
  await waitForAnimation(moveDurationMs);
}
