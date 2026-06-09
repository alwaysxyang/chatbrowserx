import type { CSSProperties, RefObject } from 'react';
import { translateMessage } from '../../../shared/i18n/i18n';
import type { ScreenshotRect } from './screenshot/screenshot-types';

interface ScreenshotControlsProps {
  controlsRef: RefObject<HTMLDivElement>;
  controlsStyle: CSSProperties;
  isCapturing: boolean;
  onFullscreenCapture: () => void;
  onDone: () => void;
}

const controlsHeight = 36;
const controlsTopOffset = 10;
const controlsViewportMargin = 8;
const estimatedControlsWidth = 190;

/**
 * Clamps a number between a minimum and maximum boundary.
 *
 * @param value - Value to clamp.
 * @param min - Lower boundary.
 * @param max - Upper boundary.
 * @returns The clamped value.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Resolves the current viewport width for control placement.
 *
 * @returns The viewport width in CSS pixels.
 */
function getViewportWidth(): number {
  return Math.max(1, window.innerWidth || document.documentElement.clientWidth || 1);
}

/**
 * Checks whether the event target belongs to the screenshot control area.
 *
 * @param target - The original event target.
 * @returns True when the target is inside the control container.
 */
export function isScreenshotControlsTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('.screenshot-controls');
}

/**
 * Builds the floating controls position for the current selection.
 *
 * @param selection - The active screenshot selection.
 * @param viewportHeight - Current viewport height.
 * @returns CSS properties that center controls above or below the selection.
 */
export function buildScreenshotControlsStyle(selection: ScreenshotRect, viewportHeight: number): CSSProperties {
  const viewportWidth = getViewportWidth();
  const clampedControlsWidth = Math.min(
    estimatedControlsWidth,
    Math.max(0, viewportWidth - controlsViewportMargin * 2),
  );
  const halfControlsWidth = clampedControlsWidth / 2;
  const minLeft = controlsViewportMargin + halfControlsWidth;
  const maxLeft = Math.max(minLeft, viewportWidth - controlsViewportMargin - halfControlsWidth);
  const belowTop = selection.top + selection.height + controlsTopOffset;
  const aboveTop = selection.top - controlsHeight - controlsTopOffset;
  const top = belowTop <= viewportHeight - 44
    ? belowTop
    : Math.max(8, aboveTop);
  const left = clamp(selection.left + selection.width / 2, minLeft, maxLeft);

  return {
    left: `${left}px`,
    top: `${top}px`,
    transform: 'translateX(-50%)',
    maxWidth: `calc(100vw - ${controlsViewportMargin * 2}px)`,
  };
}

/**
 * Renders screenshot action controls for fullscreen and selection capture.
 *
 * @param props - Control state and command handlers.
 * @returns The floating screenshot control bar.
 */
export function ScreenshotControls({
  controlsRef,
  controlsStyle,
  isCapturing,
  onFullscreenCapture,
  onDone,
}: ScreenshotControlsProps) {
  return (
    <div
      ref={controlsRef}
      className="screenshot-controls"
      data-testid="screenshot-controls"
      style={controlsStyle}
    >
      <button
        type="button"
        className="screenshot-control-button"
        disabled={isCapturing}
        onClick={onFullscreenCapture}
      >
        {translateMessage('chat.screenshot.fullscreen')}
      </button>
      <button
        type="button"
        className="screenshot-control-button screenshot-control-button-done"
        disabled={isCapturing}
        onClick={onDone}
      >
        {translateMessage('chat.screenshot.done')}
      </button>
    </div>
  );
}
