import type { ViewportPoint } from './geometry';
import {
  createOverlayElement,
  ensureOverlayRoot,
  hideVirtualCursor,
  moveVirtualCursor,
  waitForAnimation,
} from './virtual-cursor-root';

/**
 * Moves the virtual cursor to a viewport point.
 *
 * @param documentObject - The document that owns the overlay.
 * @param point - The viewport point.
 */
export async function showVirtualMouseMove(documentObject: Document, point: ViewportPoint): Promise<void> {
  await moveVirtualCursor(documentObject, point, 'pointer');
  const cursor = ensureOverlayRoot(documentObject).querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideVirtualCursor(cursor);
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

  const outerRipple = createOverlayElement(documentObject, 'click-ripple-outer', [
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
  ]);
  root.appendChild(outerRipple);

  const innerRipple = createOverlayElement(documentObject, 'click-ripple', [
    'position:absolute',
    `left:${Math.round(point.x - 18)}px`,
    `top:${Math.round(point.y - 18)}px`,
    'width:36px',
    'height:36px',
    'border:3px solid rgba(22,119,255,0.92)',
    'border-radius:999px',
    'background:rgba(22,119,255,0.2)',
    'transition:transform 260ms ease, opacity 260ms ease',
  ]);
  root.appendChild(innerRipple);

  const flash = createOverlayElement(documentObject, 'click-flash', [
    'position:absolute',
    `left:${Math.round(point.x - 5)}px`,
    `top:${Math.round(point.y - 5)}px`,
    'width:10px',
    'height:10px',
    'border-radius:999px',
    'background:#ff4d4f',
    'box-shadow:0 0 18px 8px rgba(255,77,79,0.34)',
    'transition:transform 220ms ease, opacity 220ms ease',
  ]);
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
  if (cursor) await hideVirtualCursor(cursor);
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
  const focus = createOverlayElement(documentObject, 'type-focus', [
    'position:absolute',
    `left:${Math.round(rect.left - 3)}px`,
    `top:${Math.round(rect.top - 3)}px`,
    `width:${Math.round(rect.width + 6)}px`,
    `height:${Math.round(rect.height + 6)}px`,
    'border:2px solid rgba(22,119,255,0.75)',
    'border-radius:6px',
    'box-shadow:0 0 0 3px rgba(22,119,255,0.12)',
  ]);
  root.appendChild(focus);
  await waitForAnimation(220);
  focus.remove();
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideVirtualCursor(cursor);
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
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  const line = createOverlayElement(documentObject, 'drag-path', [
    'position:absolute',
    `left:${Math.round(from.x)}px`,
    `top:${Math.round(from.y)}px`,
    `width:${Math.round(length)}px`,
    'height:2px',
    'background:rgba(22,119,255,0.65)',
    `transform:rotate(${angle}deg)`,
    'transform-origin:left center',
  ]);
  root.appendChild(line);
  await moveVirtualCursor(documentObject, to, 'hand');
  await waitForAnimation(120);
  line.remove();
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideVirtualCursor(cursor);
}

/**
 * Shows a scroll direction cue.
 *
 * @param documentObject - The document that owns the overlay.
 * @param direction - The scroll direction.
 */
export async function showVirtualScroll(documentObject: Document, direction: string): Promise<void> {
  const root = ensureOverlayRoot(documentObject);
  const cue = createOverlayElement(
    documentObject,
    'scroll-cue',
    [
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
    ],
    direction === 'up' ? '↑' : direction === 'down' ? '↓' : direction === 'left' ? '←' : '→',
  );
  root.appendChild(cue);
  await waitForAnimation(220);
  cue.remove();
  const cursor = root.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
  if (cursor) await hideVirtualCursor(cursor);
}
