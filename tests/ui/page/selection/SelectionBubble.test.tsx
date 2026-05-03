import { render, screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SelectionBubble } from '../../../../src/ui/page/selection/SelectionBubble';

const originalGetSelection = window.getSelection;
const originalInnerWidth = window.innerWidth;
const originalInnerHeight = window.innerHeight;

/**
 * Stubs a page text selection with a stable bounding box for SelectionBubble tests.
 */
function stubPageSelection(text: string, rect: DOMRect = new DOMRect(120, 120, 140, 24)): void {
  const textNode = document.createTextNode(text);
  document.body.appendChild(textNode);

  const range = {
    getBoundingClientRect: () => rect,
    getClientRects: () => [rect],
  };

  Object.defineProperty(window, 'getSelection', {
    configurable: true,
    value: vi.fn(() => ({
      anchorNode: textNode,
      rangeCount: 1,
      toString: () => text,
      getRangeAt: () => range,
    })),
  });
}

/**
 * Stubs an empty page selection.
 */
function stubEmptySelection(): void {
  Object.defineProperty(window, 'getSelection', {
    configurable: true,
    value: vi.fn(() => null),
  });
}

/**
 * Stubs viewport dimensions used by selection bubble placement.
 */
function stubViewport(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', {
    configurable: true,
    value: width,
  });
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height,
  });
}

describe('SelectionBubble', () => {
  afterEach(() => {
    Object.defineProperty(window, 'getSelection', {
      configurable: true,
      value: originalGetSelection,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      value: originalInnerWidth,
    });
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: originalInnerHeight,
    });
    document.body.innerHTML = '';
  });

  it('hides action buttons after an action opens the result dialog', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '你好' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));

    expect(await screen.findByRole('dialog', { name: 'Selection result' })).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: '翻译' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
    });
  });

  it('keeps the result dialog open when clicking inside it after page selection clears', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '你好' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));
    const dialog = await screen.findByRole('dialog', { name: 'Selection result' });

    stubEmptySelection();
    await user.click(dialog);

    expect(screen.getByRole('dialog', { name: 'Selection result' })).toBeInTheDocument();
  });

  it('keeps the result dialog open when copying its text with a keyboard shortcut', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '你好' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));
    await screen.findByRole('dialog', { name: 'Selection result' });

    stubEmptySelection();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'c', ctrlKey: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Control', bubbles: true }));
    });

    expect(screen.getByRole('dialog', { name: 'Selection result' })).toBeInTheDocument();
  });

  it('renders markdown in the result dialog', async () => {
    const sendMessageMock = globalThis.__chromeTestUtils.getRuntimeSendMessageMock();
    sendMessageMock.mockResolvedValue({ ok: true, data: { reply: '**你好**' } });
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: '翻译' }));

    const dialog = await screen.findByRole('dialog', { name: 'Selection result' });
    expect(dialog.querySelector('strong')).toHaveTextContent('你好');
  });

  it('does not recreate the toolbar after a simple page click clears the existing selection', async () => {
    stubPageSelection('Hello');

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { clientX: 190, clientY: 132, bubbles: true }));
    });

    expect(await screen.findByRole('button', { name: '翻译' })).toBeInTheDocument();

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { clientX: 190, clientY: 132, bubbles: true }));
    });
    expect(screen.queryByRole('button', { name: '翻译' })).not.toBeInTheDocument();

    await act(async () => {
      document.body.dispatchEvent(new MouseEvent('mouseup', { clientX: 190, clientY: 132, bubbles: true }));
    });
    stubEmptySelection();

    expect(screen.queryByRole('button', { name: '翻译' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ask AI' })).not.toBeInTheDocument();
  });

  it('keeps the floating bubble inside the left viewport edge', async () => {
    stubViewport(1024, 768);
    stubPageSelection('Hello', new DOMRect(0, 120, 10, 24));

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    const root = document.querySelector<HTMLElement>('.selection-bubble-root');
    expect(Number.parseFloat(root?.style.left ?? '0')).toBeGreaterThanOrEqual(226);
  });

  it('places the bubble below the selection when there is not enough room above', async () => {
    stubViewport(1024, 768);
    stubPageSelection('Hello', new DOMRect(360, 100, 120, 24));

    render(<SelectionBubble />);
    await act(async () => {
      document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    });

    expect(document.querySelector('.selection-bubble-root')).toHaveAttribute('data-placement', 'below');
  });
});
