import { describe, expect, it } from 'vitest';
import {
  showVirtualClick,
  showVirtualClickFeedback,
  showVirtualClickTarget,
  showVirtualDrag,
  showVirtualMouseMove,
  showVirtualScroll,
  showVirtualType,
} from '../../../src/ui/tools/page-action-overlay';

function makeRect(x: number, y: number, width: number, height: number): DOMRect {
  return {
    x,
    y,
    width,
    height,
    top: y,
    left: x,
    right: x + width,
    bottom: y + height,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('page action virtual mouse overlay', () => {
  it('places the cursor before showing it on the first movement', async () => {
    const movement = showVirtualMouseMove(document, { x: 40, y: 50 });

    const cursor = document.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
    expect(cursor?.dataset.positioned).toBe('true');
    expect(cursor?.style.transform).toContain('40px');
    expect(cursor?.style.transform).toContain('50px');
    expect(cursor?.style.opacity).toBe('1');

    await movement;
  });

  it('keeps the cursor geometry stable during click feedback', async () => {
    await showVirtualClickTarget(document, { x: 20, y: 30 });
    const feedback = showVirtualClickFeedback(document, { x: 20, y: 30 });

    const cursor = document.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
    expect(cursor?.style.transform).toContain('20px');
    expect(cursor?.style.transform).toContain('30px');
    expect(cursor?.style.scale).toBe('1');

    await feedback;
  });

  it('renders, moves, and auto-hides a virtual cursor', async () => {
    await showVirtualMouseMove(document, { x: 40, y: 50 });

    const cursor = document.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
    const pointer = document.querySelector('[data-role="virtual-cursor-pointer"]');
    expect(document.getElementById('chatbrowserx-page-action-overlay')).toBeTruthy();
    expect(cursor?.dataset.mode).toBe('pointer');
    expect(pointer).toBeTruthy();
    expect(cursor?.style.transform).toContain('40px');
    expect(cursor?.style.transform).toContain('50px');
    expect(cursor?.dataset.hidden).toBe('true');
    expect(cursor?.style.opacity).toBe('0');
  });

  it('switches to a virtual hand while dragging and auto-hides after release', async () => {
    await showVirtualDrag(document, { x: 10, y: 10 }, { x: 80, y: 80 });

    const cursor = document.querySelector<HTMLElement>('[data-role="virtual-cursor"]');
    const hand = document.querySelector('[data-role="virtual-cursor-hand"]');
    expect(cursor?.dataset.mode).toBe('hand');
    expect(hand).toBeTruthy();
    expect(cursor?.style.transform).toContain('80px');
    expect(cursor?.style.transform).toContain('80px');
    expect(cursor?.dataset.hidden).toBe('true');
  });

  it('shows prominent transient click, type, drag, and scroll cues', async () => {
    await showVirtualClick(document, { x: 20, y: 30 });
    await showVirtualType(document, makeRect(10, 10, 100, 30));
    await showVirtualDrag(document, { x: 10, y: 10 }, { x: 80, y: 80 });
    await showVirtualScroll(document, 'down');

    expect(document.getElementById('chatbrowserx-page-action-overlay')).toBeTruthy();
    expect(document.querySelector('[data-role="click-ripple"]')).toBeNull();
    expect(document.querySelector('[data-role="click-ripple-outer"]')).toBeNull();
    expect(document.querySelector('[data-role="click-flash"]')).toBeNull();
    expect(document.querySelector('[data-role="type-focus"]')).toBeNull();
    expect(document.querySelector('[data-role="drag-path"]')).toBeNull();
    expect(document.querySelector('[data-role="scroll-cue"]')).toBeNull();
  });
});
