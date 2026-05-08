import { useCallback, useEffect, type MutableRefObject, type RefObject } from 'react';
import {
  resolveScreenshotScrollTargetAtPoint,
  scrollScreenshotTarget,
} from './screenshot/screenshot-scroll-target';
import { isInsideSelection } from './screenshot/screenshot-selection-geometry';
import type { ScreenshotRect } from './screenshot/screenshot-types';
import { isScreenshotControlsTarget } from './screenshot-controls';
import { doesSelectionIntersectElement } from './use-screenshot-capture-runner';
import type { ScreenshotInteractionState } from './use-screenshot-interaction';

interface UseScreenshotScrollForwardingOptions {
  overlayRef: RefObject<HTMLDivElement | null>;
  selection: ScreenshotRect;
  interactionStateRef: MutableRefObject<ScreenshotInteractionState | null>;
  isCapturingRef: MutableRefObject<boolean>;
  isLongModeRef: MutableRefObject<boolean>;
  queueWheelCapture: (selection: ScreenshotRect) => void;
}

/**
 * Checks whether a scroll event target represents the document-level scroll surface.
 *
 * @param target - The scroll event target.
 * @returns True when the target is the window or document scrolling surface.
 */
export function isRootScreenshotScrollTarget(target: EventTarget | null): boolean {
  return (
    target === document ||
    target === window ||
    target === document.documentElement ||
    target instanceof Window ||
    target === document.body
  );
}

/**
 * Forwards wheel events through the overlay and queues long-screenshot captures after scrolling.
 *
 * @param options - Overlay refs, selection state, and long-mode callbacks.
 */
export function useScreenshotScrollForwarding({
  overlayRef,
  selection,
  interactionStateRef,
  isCapturingRef,
  isLongModeRef,
  queueWheelCapture,
}: UseScreenshotScrollForwardingOptions): void {
  /**
   * Returns the shadow host used to mount the content app, so hit testing can skip it.
   *
   * @returns The host elements that should be ignored during screenshot hit testing.
   */
  const getIgnoredHitTestElements = useCallback(() => {
    const rootNode = overlayRef.current?.getRootNode();

    if (rootNode instanceof ShadowRoot) {
      return [rootNode.host];
    }

    return [];
  }, [overlayRef]);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (isScreenshotControlsTarget(event.target)) {
        return;
      }

      if (interactionStateRef.current) {
        return;
      }

      if (!isLongModeRef.current && isCapturingRef.current) {
        return;
      }

      if (!isInsideSelection(event.clientX, event.clientY, selection)) {
        return;
      }

      const scrollTarget = resolveScreenshotScrollTargetAtPoint(
        event.clientX,
        event.clientY,
        getIgnoredHitTestElements(),
      );

      event.preventDefault();

      if (isLongModeRef.current) {
        scrollScreenshotTarget(scrollTarget, event.deltaX, event.deltaY);
        queueWheelCapture(selection);
        return;
      }

      scrollScreenshotTarget(scrollTarget, event.deltaX, event.deltaY);
    };

    const handleScroll = (event: Event) => {
      if (!isLongModeRef.current) {
        return;
      }

      const scrollTarget = event.target;

      if (isRootScreenshotScrollTarget(scrollTarget)) {
        queueWheelCapture(selection);
        return;
      }

      if (scrollTarget instanceof Element && doesSelectionIntersectElement(scrollTarget, selection)) {
        queueWheelCapture(selection);
      }
    };

    window.addEventListener('wheel', handleWheel, { capture: true, passive: false });
    window.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      window.removeEventListener('wheel', handleWheel, true);
      window.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [
    getIgnoredHitTestElements,
    interactionStateRef,
    isCapturingRef,
    isLongModeRef,
    queueWheelCapture,
    selection,
  ]);
}
