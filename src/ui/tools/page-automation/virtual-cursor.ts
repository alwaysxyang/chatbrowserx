export interface ViewportPoint {
  x: number;
  y: number;
}

type CursorMode = 'pointer' | 'hand';
const moveDurationMs = 280;
const settleDurationMs = 180;
const cursorTransition = `transform ${moveDurationMs}ms ease, opacity 120ms ease, scale 120ms ease`;

/**
 * Waits for a short animation duration.
 *
 * @param durationMs - Duration to wait.
 */
function waitForAnimation(durationMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, durationMs));
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
function ensureOverlayRoot(documentObject: Document): HTMLElement {
  let root = documentObject.getElementById('chatbrowserx-page-action-overlay') as HTMLElement | null;
  if (root) return root;

  root = documentObject.createElement('div');
  root.id = 'chatbrowserx-page-action-overlay';
  root.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'pointer-events:none',
    'contain:layout style paint',
  ].join(';');

  const cursor = documentObject.createElement('div');
  cursor.dataset.role = 'virtual-cursor';
  cursor.dataset.mode = 'pointer';
  cursor.style.cssText = [
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
  ].join(';');
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
async function hideCursor(cursor: HTMLElement): Promise<void> {
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
async function moveVirtualCursor(documentObject: Document, point: ViewportPoint, mode: CursorMode): Promise<void> {
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

/**
 * Moves the virtual cursor to a viewport point.
 *
 * @param documentObject - The document that owns the overlay.
 * @param point - The viewport point.
 */
export async function showVirtualMouseMove(documentObject: Document, point: ViewportPoint): Promise<void> {
  await moveVirtualCursor(documentObject, point, 'pointer');
  const cursor = ensureOverlayRoot(documentObject).querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideCursor(cursor);
}

/**
 * Moves the virtual cursor to the point that will be clicked.
 *
 * @param documentObject - The document that owns the overlay.
 * @param point - The viewport point.
 */
export async function showVirtualClickTarget(documentObject: Document, point: ViewportPoint): Promise<void> {
  await moveVirtualCursor(documentObject, point, 'pointer');
}

/**
 * Shows click feedback at the current virtual cursor point.
 *
 * @param documentObject - The document that owns the overlay.
 * @param point - The viewport point.
 */
export async function showVirtualClickFeedback(documentObject: Document, point: ViewportPoint): Promise<void> {
  const root = ensureOverlayRoot(documentObject);
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) cursor.style.scale = '1';

  const outerRipple = documentObject.createElement('div');
  outerRipple.dataset.role = 'click-ripple-outer';
  outerRipple.style.cssText = [
    'position:absolute',
    `left:${Math.round(point.x - 30)}px`,
    `top:${Math.round(point.y - 30)}px`,
    'width:60px',
    'height:60px',
    'border:3px solid rgba(255,77,79,0.82)',
    'border-radius:999px',
    'background:rgba(255,77,79,0.12)',
    'box-shadow:0 0 0 8px rgba(255,77,79,0.14)',
    'transition:transform 300ms ease, opacity 300ms ease',
  ].join(';');
  root.appendChild(outerRipple);

  const innerRipple = documentObject.createElement('div');
  innerRipple.dataset.role = 'click-ripple';
  innerRipple.style.cssText = [
    'position:absolute',
    `left:${Math.round(point.x - 18)}px`,
    `top:${Math.round(point.y - 18)}px`,
    'width:36px',
    'height:36px',
    'border:3px solid rgba(22,119,255,0.92)',
    'border-radius:999px',
    'background:rgba(22,119,255,0.2)',
    'transition:transform 260ms ease, opacity 260ms ease',
  ].join(';');
  root.appendChild(innerRipple);

  const flash = documentObject.createElement('div');
  flash.dataset.role = 'click-flash';
  flash.style.cssText = [
    'position:absolute',
    `left:${Math.round(point.x - 5)}px`,
    `top:${Math.round(point.y - 5)}px`,
    'width:10px',
    'height:10px',
    'border-radius:999px',
    'background:#ff4d4f',
    'box-shadow:0 0 18px 8px rgba(255,77,79,0.34)',
    'transition:transform 220ms ease, opacity 220ms ease',
  ].join(';');
  root.appendChild(flash);

  requestAnimationFrame(() => {
    outerRipple.style.transform = 'scale(1.9)';
    outerRipple.style.opacity = '0';
    innerRipple.style.transform = 'scale(2.2)';
    innerRipple.style.opacity = '0';
    flash.style.transform = 'scale(2.6)';
    flash.style.opacity = '0';
  });
  await waitForAnimation(340);
  outerRipple.remove();
  innerRipple.remove();
  flash.remove();
  if (cursor) await hideCursor(cursor);
}

/**
 * Shows a complete virtual click animation at a viewport point.
 *
 * @param documentObject - The document that owns the overlay.
 * @param point - The viewport point.
 */
export async function showVirtualClick(documentObject: Document, point: ViewportPoint): Promise<void> {
  await showVirtualClickTarget(documentObject, point);
  await showVirtualClickFeedback(documentObject, point);
}

/**
 * Shows a short typing focus cue around a target rectangle.
 *
 * @param documentObject - The document that owns the overlay.
 * @param rect - The target rectangle.
 */
export async function showVirtualType(documentObject: Document, rect: DOMRect): Promise<void> {
  const root = ensureOverlayRoot(documentObject);
  const focus = documentObject.createElement('div');
  focus.dataset.role = 'type-focus';
  focus.style.cssText = [
    'position:absolute',
    `left:${Math.round(rect.left - 3)}px`,
    `top:${Math.round(rect.top - 3)}px`,
    `width:${Math.round(rect.width + 6)}px`,
    `height:${Math.round(rect.height + 6)}px`,
    'border:2px solid rgba(22,119,255,0.75)',
    'border-radius:6px',
    'box-shadow:0 0 0 3px rgba(22,119,255,0.12)',
  ].join(';');
  root.appendChild(focus);
  await waitForAnimation(220);
  focus.remove();
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideCursor(cursor);
}

/**
 * Shows a virtual drag path.
 *
 * @param documentObject - The document that owns the overlay.
 * @param from - Drag start point.
 * @param to - Drag end point.
 */
export async function showVirtualDrag(documentObject: Document, from: ViewportPoint, to: ViewportPoint): Promise<void> {
  const root = ensureOverlayRoot(documentObject);
  await moveVirtualCursor(documentObject, from, 'hand');
  const line = documentObject.createElement('div');
  line.dataset.role = 'drag-path';
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  line.style.cssText = [
    'position:absolute',
    `left:${Math.round(from.x)}px`,
    `top:${Math.round(from.y)}px`,
    `width:${Math.round(length)}px`,
    'height:2px',
    'background:rgba(22,119,255,0.65)',
    `transform:rotate(${angle}deg)`,
    'transform-origin:left center',
  ].join(';');
  root.appendChild(line);
  await moveVirtualCursor(documentObject, to, 'hand');
  await waitForAnimation(120);
  line.remove();
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideCursor(cursor);
}

/**
 * Shows a scroll direction cue.
 *
 * @param documentObject - The document that owns the overlay.
 * @param direction - The scroll direction.
 */
export async function showVirtualScroll(documentObject: Document, direction: string): Promise<void> {
  const root = ensureOverlayRoot(documentObject);
  const cue = documentObject.createElement('div');
  cue.dataset.role = 'scroll-cue';
  cue.textContent = direction === 'up' ? '↑' : direction === 'down' ? '↓' : direction === 'left' ? '←' : '→';
  cue.style.cssText = [
    'position:absolute',
    'left:50%',
    'top:50%',
    'width:44px',
    'height:44px',
    'margin-left:-22px',
    'margin-top:-22px',
    'border-radius:999px',
    'display:grid',
    'place-items:center',
    'font:600 24px system-ui',
    'color:#1677ff',
    'background:rgba(22,119,255,0.12)',
    'box-shadow:0 0 0 4px rgba(22,119,255,0.1)',
  ].join(';');
  root.appendChild(cue);
  await waitForAnimation(220);
  cue.remove();
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideCursor(cursor);
}
